import { Router, Request, Response } from 'express';
import { startCrawl, getCrawlStatus, cancelCrawl, checkSFAvailability } from '../crawler/sf-crawler.js';
import { parseSFCrawlOutput } from '../parsers/sf-parser.js';
import { sheetsService } from '../sheets/index.js';
import { runBatchPSI, calculateAggregatePSIScores } from '../psi/batch-psi.js';
import type { SFCrawlResult } from '../parsers/sf-parser.js';
import type { PSIResult } from '../psi/types.js';
import type { FullAuditResponse } from '../types.js';
import { db } from '../db/index.js';
import { audits } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export const crawlRouter = Router();

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(audits).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

// POST /start - Start a new crawl
crawlRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { url, maxPages, maxDepth } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const job = await startCrawl({
      url,
      maxPages: maxPages || 100,
      maxDepth: maxDepth || 3,
    });

    res.json({
      crawlId: job.id,
      url: job.url,
      status: job.status,
      progress: job.progress,
      startTime: job.startTime,
    });
  } catch (error) {
    console.error('Start crawl error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start crawl';
    res.status(500).json({ error: message });
  }
});

// GET /status - Check if crawler is available
crawlRouter.get('/status', async (_req: Request, res: Response) => {
  const result = await checkSFAvailability();
  res.json({ 
    screamingFrog: { 
      available: result.available,
      mockMode: result.mockMode,
      error: result.error
    } 
  });
});

// GET /:crawlId - Get crawl job status
crawlRouter.get('/:crawlId', (req: Request, res: Response) => {
  const { crawlId } = req.params;
  const job = getCrawlStatus(crawlId);

  if (!job) {
    return res.status(404).json({ error: 'Crawl job not found' });
  }

  res.json(job);
});

// GET /:crawlId/status - Get crawl job status (alias)
crawlRouter.get('/:crawlId/status', (req: Request, res: Response) => {
  const { crawlId } = req.params;
  const job = getCrawlStatus(crawlId);

  if (!job) {
    return res.status(404).json({ error: 'Crawl job not found' });
  }

  res.json(job);
});

// DELETE /:crawlId - Cancel a crawl
crawlRouter.delete('/:crawlId', (req: Request, res: Response) => {
  const { crawlId } = req.params;
  
  try {
    cancelCrawl(crawlId);
    res.json({ success: true, message: 'Crawl cancelled' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel crawl';
    res.status(500).json({ error: message });
  }
});

crawlRouter.post('/:crawlId/save', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available',
      hint: 'Set up PostgreSQL with DATABASE_URL environment variable'
    });
  }

  const { crawlId } = req.params;
  const { 
    includePsi = false, 
    psiMaxPages = 10, 
    psiConcurrency = 2, 
    exportToSheets = false, 
    sheetsClearExisting = true,
    createNewSpreadsheet = false
  } = req.body;
  
  const job = getCrawlStatus(crawlId);

  if (!job) {
    return res.status(404).json({ error: 'Crawl job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ 
      error: 'Crawl not completed',
      status: job.status,
    });
  }

  try {
    const sfResults: SFCrawlResult = await parseSFCrawlOutput(job.outputDir);

    if (includePsi && sfResults.pages.length > 0) {
      const urlsToAudit = sfResults.pages
        .filter(p => p.statusCode === 200)
        .slice(0, psiMaxPages)
        .map(p => p.url);

      console.log(`[Crawl] Running PSI for ${urlsToAudit.length} pages...`);

      const psiBatch = await runBatchPSI({
        urls: urlsToAudit,
        concurrency: psiConcurrency,
        delayBetweenRequests: 500,
        onProgress: (completed, total, url) => {
          console.log(`[PSI] ${completed}/${total}: ${url}`);
        },
      });

      for (const page of sfResults.pages) {
        const psiData = psiBatch.results.get(page.url);
        if (psiData) {
          page.psi = psiData;
          console.log(`[PSI] Attached PSI to ${page.url}`);
        }
      }
      console.log(`[PSI] Batch results: ${psiBatch.completed} completed, ${psiBatch.failed} failed, map size: ${psiBatch.results.size}`);

      sfResults.psiScores = calculateAggregatePSIScores(sfResults.pages);

      if (psiBatch.failed > 0) {
        console.log(`[PSI] Failed for ${psiBatch.failed} pages:`);
        psiBatch.errors.forEach((error, url) => {
          console.log(`  - ${url}: ${error}`);
        });
      }
    }

    const overallScore = sfResults.psiScores
      ? Math.round((sfResults.scores.overall + sfResults.psiScores.avgOverallPerformance) / 2)
      : sfResults.scores.overall;

    const existing = await db.select().from(audits).where(
      and(
        eq(audits.url, job.url),
        eq(audits.auditType, 'crawl'),
        eq(audits.startTime, job.startTime)
      )
    ).limit(1);

    let saved;
    if (existing.length > 0) {
      [saved] = await db.update(audits)
        .set({
          overallScore,
          status: 'completed',
          endTime: job.endTime || new Date(),
          auditData: sfResults as unknown as Record<string, unknown>,
        })
        .where(eq(audits.id, existing[0].id))
        .returning();
      console.log(`[Crawl] Updated existing audit ${saved.id}`);
    } else {
      [saved] = await db.insert(audits).values({
        url: job.url,
        overallScore,
        status: 'completed',
        auditType: 'crawl',
        startTime: job.startTime,
        endTime: job.endTime || new Date(),
        auditData: sfResults as unknown as Record<string, unknown>,
      }).returning();
      console.log(`[Crawl] Created new audit ${saved.id}`);
    }

    const response: FullAuditResponse = {
      id: saved.id,
      url: saved.url,
      status: saved.status,
      auditType: saved.auditType,
      startTime: saved.startTime,
      endTime: saved.endTime,
      createdAt: saved.createdAt,
      overallScore,
      sf: sfResults,
      psi: sfResults.psiScores as unknown as PSIResult | undefined,
    };

    let sheetsExportResult = null;
    if (exportToSheets && sheetsService.isConfigured()) {
      try {
        if (createNewSpreadsheet) {
          const pagesWithPsi = sfResults.pages?.filter((p: any) => p.psi)?.length || 0;
          console.log(`[Crawl] Creating new spreadsheet with ${sfResults.pages?.length} pages, ${pagesWithPsi} with PSI`);
          
          sheetsExportResult = await sheetsService.exportToNewSpreadsheet(sfResults, job.url);
          console.log(`[Crawl] Created new spreadsheet: ${sheetsExportResult.spreadsheetUrl}`);
        } else {
          console.log(`[Crawl] Auto-exporting issues to Google Sheets...`);
          sheetsExportResult = await sheetsService.exportCrawlIssues(sfResults, job.url, {
            clearExisting: sheetsClearExisting,
          });
          console.log(`[Crawl] Exported ${sheetsExportResult.rowsExported} rows to Google Sheets`);
        }
      } catch (sheetsError) {
        console.error('[Crawl] Sheets export failed:', sheetsError);
        sheetsExportResult = {
          success: false,
          issuesFound: 0,
          rowsExported: 0,
          error: sheetsError instanceof Error ? sheetsError.message : 'Unknown error',
        };
      }
    }

    res.json({
      ...response,
      sheetsExport: sheetsExportResult ? {
        attempted: true,
        ...sheetsExportResult,
      } : {
        attempted: false,
        reason: exportToSheets && !sheetsService.isConfigured() 
          ? 'Google Sheets not configured' 
          : 'Export not requested',
      },
    });
  } catch (error) {
    console.error('Save crawl error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save crawl results';
    res.status(500).json({ error: message });
  }
});
