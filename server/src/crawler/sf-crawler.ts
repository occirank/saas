import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, ScreamingFrogConfig } from './config.js';
import { db } from '../db/index.js';
import { audits } from '../db/schema.js';
import { parseSFCrawlOutput } from '../parsers/sf-parser.js';
import { sheetsService, extractOnPageIssues, generateAuditChecklist, exportChecklistToCSV } from '../sheets/index.js';
import { getGSCService } from '../gsc/index.js';
import { getAhrefsProxyService } from '../ahrefs/index.js';
import type { BacklinkAnalysisResult, BacklinkCheckResult } from '../ahrefs/types.js';
import { runBacklinkChecks, extractSFBrokenLinks, summarizeBacklinkHealth } from '../audits/backlink-checks.js';

export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface TimeoutInfo {
  limitMinutes: number;
  startTime: Date;
  elapsedMinutes: number;
  remainingMinutes: number;
  percentage: number;
  warnings: string[];
  isNearTimeout: boolean;
  isCritical: boolean;
}

export interface CrawlJob {
  id: string;
  url: string;
  status: CrawlStatus;
  progress: number;
  startTime: Date;
  endTime?: Date;
  outputDir: string;
  error?: string;
  config: ScreamingFrogConfig;
  process?: ChildProcess;
  isMock?: boolean;
  timeoutInfo?: TimeoutInfo;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

export interface CrawlOptions {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  maxThreads?: number;
}

// Track active crawl jobs
const activeCrawls = new Map<string, CrawlJob>();

// Check if we're in test/mock mode
// Check if we're in test/mock mode
const MOCK_MODE = process.env.MOCK_SF === 'true' || process.env.NODE_ENV === 'test';


// Timeout tracking interval references
const timeoutIntervals = new Map<string, NodeJS.Timeout>();

/**
 * Calculate timeout info for a crawl job
 */
function calculateTimeoutInfo(job: CrawlJob): TimeoutInfo {
  const limitMinutes = job.config.crawlSettings.timeout || 480;
  const startTime = job.startTime;
  const now = new Date();
  const elapsedMs = now.getTime() - startTime.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const remainingMinutes = Math.max(0, limitMinutes - elapsedMinutes);
  const percentage = Math.min(100, (elapsedMinutes / limitMinutes) * 100);
  
  const warnings: string[] = [];
  if (percentage >= 80) {
    warnings.push(`Crawl has used ${percentage.toFixed(1)}% of timeout limit`);
  }
  if (percentage >= 90) {
    warnings.push('Crawl approaching timeout - consider cancelling if stuck');
  }
  if (elapsedMinutes > 10 && job.progress < 10) {
    warnings.push('Low progress after 10 minutes - crawl may be stuck');
  }
  
  return {
    limitMinutes,
    startTime,
    elapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
    remainingMinutes: Math.round(remainingMinutes * 10) / 10,
    percentage: Math.round(percentage * 10) / 10,
    warnings,
    isNearTimeout: percentage >= 80,
    isCritical: percentage >= 90,
  };
}

/**
 * Start timeout monitoring for a crawl job
 */
function startTimeoutMonitoring(job: CrawlJob): void {
  // Clear any existing interval
  const existingInterval = timeoutIntervals.get(job.id);
  if (existingInterval) {
    clearInterval(existingInterval);
  }
  
  // Check timeout every 30 seconds
  const interval = setInterval(() => {
    if (job.status !== 'running') {
      clearInterval(interval);
      timeoutIntervals.delete(job.id);
      return;
    }
    
    job.timeoutInfo = calculateTimeoutInfo(job);
    
    // Log warnings
    if (job.timeoutInfo.warnings.length > 0) {
      console.log(`[SF Crawler] Timeout warning for ${job.id}:`);
      job.timeoutInfo.warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    // Auto-cancel if timeout exceeded
    if (job.timeoutInfo.percentage >= 100) {
      console.log(`[SF Crawler] Crawl ${job.id} exceeded timeout limit, cancelling...`);
      cancelCrawl(job.id);
      job.status = 'timeout';
      job.error = `Crawl timed out after ${job.timeoutInfo.limitMinutes} minutes`;
      job.endTime = new Date();
    }
  }, 30000);
  
  timeoutIntervals.set(job.id, interval);
  
  // Initial timeout info
  job.timeoutInfo = calculateTimeoutInfo(job);
}

/**
 * Stop timeout monitoring for a crawl job
 */
function stopTimeoutMonitoring(jobId: string): void {
  const interval = timeoutIntervals.get(jobId);
  if (interval) {
    clearInterval(interval);
    timeoutIntervals.delete(jobId);
  }
}

/**
 * Get timeout info for a crawl job
 */
export function getTimeoutInfo(crawlId: string): TimeoutInfo | undefined {
  const job = activeCrawls.get(crawlId);
  if (!job) return undefined;
  return calculateTimeoutInfo(job);
}
/**
 * Generate a unique crawl ID
 */
function generateCrawlId(url: string): string {
  const urlHash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '').substring(0, 8);
  const timestamp = Date.now().toString(36);
  return `crawl_${urlHash}_${timestamp}`;
}

/**
 * Save completed crawl to database
 */
async function saveCrawlToDatabase(job: CrawlJob): Promise<void> {
  try {
    // Parse the crawl results
    const results = await parseSFCrawlOutput(job.outputDir);
    
    // Save to database
    const [saved] = await db.insert(audits).values({
      url: job.url,
      overallScore: results.scores.overall,
      status: 'completed',
      auditType: 'crawl',
      startTime: job.startTime,
      endTime: job.endTime || new Date(),
      auditData: {
        crawlId: job.id,
        url: job.url,
        startTime: job.startTime.toISOString(),
        endTime: (job.endTime || new Date()).toISOString(),
        summary: results.summary,
        pages: results.pages,
        issues: results.issues,
        scores: results.scores,
      },
    }).returning();
    
    console.log(`[SF Crawler] Saved crawl to database with ID: ${saved.id}`);
  } catch (error) {
    console.error(`[SF Crawler] Failed to save crawl to database:`, error);
    // Don't throw - the crawl itself succeeded
  }

}
/**
 * Auto-export crawl issues to Google Sheets and CSV after completion
 */
async function autoExportToSheets(job: CrawlJob): Promise<void> {
  try {
    console.log(`[SF Crawler] Exporting audit checklist...`);
    
    // Parse crawl results for export
    const results = await parseSFCrawlOutput(job.outputDir);
    
    // Generate checklist from crawl issues
    const crawlIssues = extractOnPageIssues(results, job.url);
    let allIssues: any[] = [...crawlIssues];
    
    // Try to fetch GSC issues (if configured)
    const gscService = getGSCService();
    let gscPageAnalytics: Map<string, { clicks: number }> | undefined;
    
    if (gscService.isConnected()) {
      try {
        console.log(`[SF Crawler] Fetching GSC data...`);
        const gscIssueTypes = await gscService.extractGSCIssues(job.url);
        
        // Convert GSC issue types to OnPageIssue format (with all required properties)
        const gscIssues = gscIssueTypes.map(issueType => ({
          url: job.url,
          issueType,
          category: 'Google Search Console',
          severity: 'warning' as const,
          statusCode: 200,
          crawlDate: new Date().toISOString(),
          siteUrl: job.url,
          title: '',
          h1: '',
          h2: '',
          metaDescription: '',
          wordCount: undefined,
          pageSize: undefined,
          responseTime: undefined,
          titlePixelWidth: undefined,
          metaDescPixelWidth: undefined,
          h1Length: undefined,
          h2Length: undefined,
          crawlDepth: undefined,
          inlinks: undefined,
          canonical: undefined,
          relNext: undefined,
          relPrev: undefined,
          metaRobots: undefined,
          redirectType: undefined,
          metaRefresh: undefined,
          psiMobileScore: undefined,
          psiDesktopScore: undefined,
          hasCampaignUrls: undefined,
          analyticsType: undefined,
          imageCount: undefined,
          imagesMissingAlt: undefined,
          largeImages: undefined,
          hasStructuredData: undefined,
          structuredDataErrors: undefined,
          isDuplicateTitle: undefined,
          isDuplicateH1: undefined,
          isDuplicateMetaDesc: undefined,
        }));
        
        allIssues = [...allIssues, ...gscIssues];
        console.log(`[SF Crawler] Added ${gscIssues.length} GSC issues`);
        
        // Fetch GSC page analytics for traffic column
        console.log(`[SF Crawler] Fetching GSC page analytics...`);
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90 days
        const analytics = await gscService.getSearchAnalytics(job.url, startDate, endDate, ['page'], 1000);
        gscPageAnalytics = new Map();
        for (const page of analytics.pages) {
          gscPageAnalytics.set(page.page, { clicks: page.clicks });
        }
        console.log(`[SF Crawler] Got traffic data for ${gscPageAnalytics.size} pages`);
      } catch (gscError) {
        console.log(`[SF Crawler] GSC not available or error:`, gscError);
      }
    } else {
      console.log(`[SF Crawler] GSC not connected, skipping GSC issues`);
    }

    let backlinkResults: BacklinkAnalysisResult | null = null;
    const ahrefsService = getAhrefsProxyService();
    
    if (ahrefsService.isConfigured()) {
      try {
        console.log(`[SF Crawler] Fetching Ahrefs backlink data...`);
        backlinkResults = await ahrefsService.getFullAnalysis(job.url);
        console.log(`[SF Crawler] Ahrefs: DR=${backlinkResults.domainRating}, Refdomains=${backlinkResults.totalRefdomains}, Backlinks=${backlinkResults.totalBacklinks}`);
        
        const sfBrokenLinks = extractSFBrokenLinks(results.pages || []);
        const backlinkChecks = await runBacklinkChecks({
          domain: job.url,
          country: 'fr',
          sfBrokenLinks,
        });
        
        const backlinkIssues = backlinkChecks.map(check => ({
          url: job.url,
          issueType: check.question,
          category: 'Backlinks',
          severity: check.status === 'fail' ? 'critical' : check.status === 'warning' ? 'warning' : 'info',
          statusCode: 200,
          crawlDate: new Date().toISOString(),
          siteUrl: job.url,
          title: '',
          h1: '',
          h2: '',
          metaDescription: '',
          wordCount: undefined,
          pageSize: undefined,
          responseTime: undefined,
          titlePixelWidth: undefined,
          metaDescPixelWidth: undefined,
          h1Length: undefined,
          h2Length: undefined,
          crawlDepth: undefined,
          inlinks: undefined,
          canonical: undefined,
          relNext: undefined,
          relPrev: undefined,
          metaRobots: undefined,
          redirectType: undefined,
          metaRefresh: undefined,
          psiMobileScore: undefined,
          psiDesktopScore: undefined,
          hasCampaignUrls: undefined,
          analyticsType: undefined,
          imageCount: undefined,
          imagesMissingAlt: undefined,
          largeImages: undefined,
          hasStructuredData: undefined,
          structuredDataErrors: undefined,
          isDuplicateTitle: undefined,
          isDuplicateH1: undefined,
          isDuplicateMetaDesc: undefined,
        }));
        
        allIssues = [...allIssues, ...backlinkIssues];
        console.log(`[SF Crawler] Added ${backlinkIssues.length} backlink quality issues`);
      } catch (ahrefsError) {
        console.log(`[SF Crawler] Ahrefs not available or error:`, ahrefsError);
      }
    } else {
      console.log(`[SF Crawler] Ahrefs proxy not configured, skipping backlink analysis`);
    }

    const checklist = generateAuditChecklist(allIssues);
    
    // Export to CSV (always)
    const csvPath = path.join(job.outputDir, 'audit_checklist.csv');
    exportChecklistToCSV(checklist, csvPath);
    
    // Always create new spreadsheet if Google Sheets is configured
    if (sheetsService.isConfigured()) {
      const result = await sheetsService.exportToNewSpreadsheet(results, job.url, {
        precomputedIssues: allIssues,
        gscPageAnalytics,
      });
      
      if (result.success) {
        console.log(`[SF Crawler] Questions: ${result.questionsAnswered}, Issues: ${result.issuesFound}, Pages: ${result.pagesExported}, Images: ${result.imagesExported}, Problems: ${result.problemsExported}`);
        // Save spreadsheet ID and URL to job for reference
        job.spreadsheetId = result.spreadsheetId;
        job.spreadsheetUrl = result.spreadsheetUrl;
      } else {
        console.error(`[SF Crawler] Sheets export failed: ${result.error}`);
      }
    } else {
      console.log(`[SF Crawler] Google Sheets not configured, skipping spreadsheet creation`);
    }
  } catch (error) {
    console.error(`[SF Crawler] Export error:`, error);
  }
}

/**
 * Start a new crawl job using Screaming Frog CLI
 */
export async function startCrawl(options: CrawlOptions): Promise<CrawlJob> {
  const config = getConfig();
  const crawlId = generateCrawlId(options.url);
  const outputDir = path.join(config.outputDir, crawlId);

  // Create output directory (ensure it exists before SF starts)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  // Verify directory exists
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Failed to create output directory: ${outputDir}`);
  }
  console.log(`[SF Crawler] Output directory created: ${outputDir}`);
  const job: CrawlJob = {
    id: crawlId,
    url: options.url,
    status: 'pending',
    progress: 0,
    startTime: new Date(),
    outputDir,
    config,
  };

  activeCrawls.set(crawlId, job);
  
  // Start timeout monitoring
  startTimeoutMonitoring(job);

  // Check if SF is available
  const sfAvailable = await isSFAvailableSync(config);
  
  if (MOCK_MODE || !sfAvailable) {
    // Use mock mode for testing
    job.isMock = true;
    console.log(`[SF Crawler] Using MOCK mode (SF not available or MOCK_SF=true)`);
    runMockCrawl(job, options).catch((error) => {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
    });
  } else {
    // Start the real crawl in the background
    runCrawlProcess(job, options).catch((error) => {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
    });
  }

  return job;
}

/**
 * Check if SF is available synchronously
 */
async function isSFAvailableSync(config: ScreamingFrogConfig): Promise<boolean> {
  try {
    await fs.promises.access(config.cliPath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a mock crawl for testing (no Screaming Frog needed)
 */
async function runMockCrawl(job: CrawlJob, _options: CrawlOptions): Promise<void> {
  console.log(`[Mock SF] Starting mock crawl for ${job.url}`);
  
  job.status = 'running';
  
  // Simulate crawl progress over time
  for (let progress = 0; progress <= 100; progress += 10) {
    await new Promise(resolve => setTimeout(resolve, 500));
    job.progress = progress;
    console.log(`[Mock SF] Progress: ${progress}%`);
  }
  
  // Generate mock output CSV
  const mockCsv = generateMockCsv(job.url);
  await fs.promises.writeFile(path.join(job.outputDir, 'internal_all.csv'), mockCsv);
  
  // Stop timeout monitoring
  stopTimeoutMonitoring(job.id);
  
  job.status = 'completed';
  job.progress = 100;
  job.endTime = new Date();
  
  // Save crawl to database
  await saveCrawlToDatabase(job);
  
  // Auto-export to Google Sheets
  await autoExportToSheets(job);
  
  console.log(`[Mock SF] Crawl completed!`);
}

/**
 * Generate mock CSV data for testing
 */
function generateMockCsv(baseUrl: string): string {
  let domain: string;
  try {
    domain = new URL(baseUrl).hostname;
  } catch {
    domain = 'example.com';
  }
  
  const pages = [
    { url: baseUrl, title: `${domain} - Home`, desc: 'Welcome to our website. We offer great services and solutions for your business needs.', h1: 'Welcome', status: 200, words: 450, size: '125KB', time: '245ms' },
    { url: `${baseUrl}/about`, title: `About Us - ${domain}`, desc: 'Learn more about our company and our mission to deliver excellence.', h1: 'About Us', status: 200, words: 320, size: '98KB', time: '189ms' },
    { url: `${baseUrl}/services`, title: `Our Services - ${domain}`, desc: 'Discover our comprehensive range of professional services.', h1: 'Our Services', status: 200, words: 580, size: '156KB', time: '312ms' },
    { url: `${baseUrl}/contact`, title: `Contact`, desc: 'Get in touch', h1: 'Contact', status: 200, words: 150, size: '67KB', time: '178ms' },
    { url: `${baseUrl}/blog`, title: `${domain} Blog`, desc: '', h1: '', status: 200, words: 890, size: '234KB', time: '456ms' },
    { url: `${baseUrl}/products`, title: `Products - ${domain} - Best Products Online Store`, desc: 'Browse our extensive catalog of premium products designed to meet all your needs.', h1: 'Products', status: 200, words: 720, size: '189KB', time: '267ms' },
    { url: `${baseUrl}/old-page`, title: '', desc: '', h1: '', status: 404, words: 0, size: '2KB', time: '12ms' },
    { url: `${baseUrl}/redirect`, title: 'Redirect', desc: 'This page redirects', h1: 'Redirect', status: 301, words: 0, size: '1KB', time: '8ms' },
  ];

const headers = [
    'Address', 'Status Code', 'Status', 'Title 1', 'Title 1 Length',
    'Meta Description 1', 'Meta Description 1 Length', 'H1-1', 'H1-1 Length',
    'Word Count', 'Size', 'Response Time', 'Indexability', 'Content Type',
    'Redirect URI', 'Redirect Type'
  ];

const rows = pages.map(p => [
    `"${p.url}"`,
    p.status,
    p.status === 200 ? 'OK' : p.status === 404 ? 'Not Found' : 'Moved Permanently',
    `"${p.title}"`,
    p.title.length,
    `"${p.desc}"`,
    p.desc.length,
    `"${p.h1}"`,
    p.h1.length,
    p.words,
    `"${p.size}"`,
    `"${p.time}"`,
    '"Indexable"',
    '"text/html; charset=utf-8"',
    p.status >= 300 && p.status < 400 ? `"${baseUrl}/services"` : '""',
    p.status >= 300 && p.status < 400 ? '"301 Permanent"' : '""'
  ].join(','));

  return headers.join(',') + '\n' + rows.join('\n');
}

/**
 * Run the Screaming Frog CLI process
 */
async function runCrawlProcess(job: CrawlJob, options: CrawlOptions): Promise<void> {
  const config = job.config;
  
// Build CLI arguments - using correct SF CLI syntax
  const exportTabs = [
    'Internal:All',
    'External:All',
    'Response Codes:All',
    'Images:All',
    'Page Titles:All',
    'Meta Description:All',
    'H1:All',
  ].join(',');

  const args = [
    '--headless',                       // Run without GUI
    '--crawl', job.url,                 // URL to crawl
    '--output-folder', job.outputDir,   // Output directory
    '--export-tabs', `"${exportTabs}"`, // Export data tabs (quoted for shell)
    '--overwrite',                      // Overwrite existing files
  ];

  // Note: Crawl limits (maxPages, maxDepth, maxThreads) must be configured
  // via a config file passed to --config. CLI does not support these directly.
  console.log(`[SF Crawler] Starting crawl for ${job.url}`);
  console.log(`[SF Crawler] CLI path: ${config.cliPath}`);
  console.log(`[SF Crawler] Args: ${args.join(' ')}`);

  job.status = 'running';

  return new Promise((resolve, reject) => {
    const sfProcess = spawn(`"${config.cliPath}"`, args, {
      windowsHide: true,
      shell: true,
    });
    console.log(`[SF Crawler] Process started with PID: ${sfProcess.pid}`);

    job.process = sfProcess;

    let stdout = '';
    let stderr = '';

    sfProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[SF stdout] ${output.trim()}`);
      const progressMatch = output.match(/(\d+)%/);
      if (progressMatch) {
        job.progress = parseInt(progressMatch[1], 10);
        console.log(`[SF Crawler] Progress: ${job.progress}%`);
      }
    });

    sfProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log(`[SF stderr] ${output.trim()}`);
    });

    sfProcess.on('error', (error) => {
      console.error(`[SF Crawler] Process error: ${error.message}`);
      reject(new Error(`Failed to start Screaming Frog: ${error.message}`));
    });

    sfProcess.on('close', async (code) => {
      // Stop timeout monitoring
      stopTimeoutMonitoring(job.id);
      
      if (code === 0) {
        console.log(`[SF Crawler] Crawl completed successfully`);
        job.status = 'completed';
        job.progress = 100;
        job.endTime = new Date();
        
        // Save crawl to database
        await saveCrawlToDatabase(job);
        
        // Auto-export to Google Sheets
        await autoExportToSheets(job);
        resolve();
      } else {
        console.error(`[SF Crawler] Crawl failed with code ${code}`);
        console.error(`[SF Crawler] stderr: ${stderr}`);
        reject(new Error(`Screaming Frog exited with code ${code}: ${stderr}`));
      }
    });

    // Set timeout
    const timeout = (config.crawlSettings.timeout || 30) * 60 * 1000;
    setTimeout(() => {
      if (job.status === 'running') {
        console.log(`[SF Crawler] Crawl timed out after ${timeout}ms`);
        sfProcess.kill();
        reject(new Error('Crawl timed out'));
      }
    }, timeout);
  });
}

/**
 * Get the status of a crawl job
 */
export function getCrawlStatus(crawlId: string): CrawlJob | undefined {
  return activeCrawls.get(crawlId);
}

/**
 * Cancel an active crawl job
 */
export function cancelCrawl(crawlId: string): boolean {
  const job = activeCrawls.get(crawlId);
  if (!job || job.status !== 'running') {
    return false;
  }

  // Stop timeout monitoring
  stopTimeoutMonitoring(crawlId);

  if (!job.isMock) {
    job.process?.kill();
  }
  job.status = 'cancelled';
  job.endTime = new Date();
  return true;
}

/**
 * List all crawl jobs
 */
export function listCrawls(): CrawlJob[] {
  return Array.from(activeCrawls.values());
}

/**
 * Check if Screaming Frog CLI is available
 */
export async function checkSFAvailability(): Promise<{ available: boolean; path: string; error?: string; mockMode: boolean }> {
  const config = getConfig();
  
  if (MOCK_MODE) {
    return { 
      available: true, 
      path: config.cliPath,
      mockMode: true,
    };
  }
  
  try {
    await fs.promises.access(config.cliPath, fs.constants.X_OK);
    return { available: true, path: config.cliPath, mockMode: false };
  } catch {
    return { 
      available: false, 
      path: config.cliPath,
      error: `Screaming Frog CLI not found. Install SF or set MOCK_SF=true for testing.`,
      mockMode: false,
    };
}
}
