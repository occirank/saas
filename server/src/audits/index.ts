import * as cheerio from 'cheerio';
import type { AuditResult, AuditContext, CheckResult, CategoryResult } from '../types.js';
import { metaTagsChecks } from './meta-tags.js';
import { headingsChecks } from './headings.js';
import { imagesChecks } from './images.js';
import { linksChecks } from './links.js';
import { technicalChecks } from './technical.js';
import { performanceChecks } from './performance.js';
import { keywordChecks } from './keyword-checks.js';
import { architectureChecks } from './architecture.js';
import { siteStructureChecks } from './site-structure.js';
import { navigationChecks } from './navigation.js';
import { typographyChecks } from './typography.js';
import { analyticsChecks } from './analytics.js';
import { generateSeoAnswers, calculateOverallSeoScore, getSeoAuditSummary } from './seo-questions.js';

// Re-export for external use
export { generateSeoAnswers, calculateOverallSeoScore, getSeoAuditSummary };
export { SEO_QUESTIONS, getQuestionsByCategory } from './seo-questions.js';
export { checkKeywordPositions, checkMultipleKeywords } from './keyword-checks.js';
export { analyzeUrlArchitecture } from './architecture.js';
export { analyzeSiteStructure } from './site-structure.js';
export { extractNavigationStructure } from './navigation.js';
export { detectAnalytics } from './analytics.js';
export { extractHeadingStyles } from './typography.js';

export async function runFullAudit(url: string): Promise<AuditResult> {
  const context = await fetchPageContext(url);
  
  const categories: CategoryResult[] = [];
  
  // Run all audit categories in parallel
  const [
    metaResults,
    headingResults,
    imageResults,
    linkResults,
    technicalResults,
    performanceResults,
    keywordResults,
    architectureResults,
    siteStructureResults,
    navigationResults,
    typographyResults,
    analyticsResults,
  ] = await Promise.all([
    runChecks(metaTagsChecks, context),
    runChecks(headingsChecks, context),
    runChecks(imagesChecks, context),
    runChecks(linksChecks, context),
    runChecks(technicalChecks, context),
    runChecks(performanceChecks, context),
    runChecks(keywordChecks, context),
    runChecks(architectureChecks, context),
    runChecks(siteStructureChecks, context),
    runChecks(navigationChecks, context),
    runChecks(typographyChecks, context),
    runChecks(analyticsChecks, context),
  ]);

  categories.push(
    createCategory('Meta Tags & SEO', metaResults),
    createCategory('Headings Structure', headingResults),
    createCategory('Images', imageResults),
    createCategory('Links', linkResults),
    createCategory('Technical SEO', technicalResults),
    createCategory('Performance', performanceResults),
    createCategory('Keywords', keywordResults),
    createCategory('URL Architecture', architectureResults),
    createCategory('Site Structure', siteStructureResults),
    createCategory('Navigation', navigationResults),
    createCategory('Typography', typographyResults),
    createCategory('Analytics', analyticsResults)
  );

  const overallScore = Math.round(
    categories.reduce((sum, cat) => sum + cat.score, 0) / categories.length
  );

  return {
    url,
    timestamp: new Date().toISOString(),
    overallScore,
    categories,
  };
}

async function fetchPageContext(url: string): Promise<AuditContext> {
  const startTime = Date.now();
  
  // Track redirect chain
  const redirectChain: { url: string; statusCode: number }[] = [];
  let currentUrl = url;
  let response: Response;
  const maxRedirects = 10;
  
  for (let i = 0; i <= maxRedirects; i++) {
    response = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'OcciRank-SEO-Audit-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'manual',
    });
    
    // Check if this is a redirect
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      redirectChain.push({ url: currentUrl, statusCode: response.status });
      const location = response.headers.get('location')!;
      // Resolve relative URLs
      currentUrl = new URL(location, currentUrl).href;
    } else {
      // Not a redirect, this is our final response
      break;
    }
  }

  const responseTime = Date.now() - startTime;
  const html = await response!.text();
  const $ = cheerio.load(html);

  // Fetch robots.txt and sitemap.xml
  const urlObj = new URL(url);
  let robotsTxt: string | undefined;
  let sitemapXml: string | undefined;

  try {
    const robotsResponse = await fetch(`${urlObj.origin}/robots.txt`);
    if (robotsResponse.ok) {
      robotsTxt = await robotsResponse.text();
    }
  } catch {
    // robots.txt not found
  }

  try {
    const sitemapResponse = await fetch(`${urlObj.origin}/sitemap.xml`);
    if (sitemapResponse.ok) {
      sitemapXml = await sitemapResponse.text();
    }
  } catch {
    // sitemap.xml not found
  }

  const headers: Record<string, string> = {};
  response!.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    url,
    html,
    $,
    responseTime,
    statusCode: response!.status,
    headers,
    robotsTxt,
    sitemapXml,
    redirectChain: redirectChain.length > 0 ? redirectChain : undefined,
  };
}

async function runChecks(
  checks: ((ctx: AuditContext) => Promise<CheckResult>)[],
  ctx: AuditContext
): Promise<CheckResult[]> {
  return Promise.all(checks.map((check) => check(ctx)));
}

function createCategory(name: string, checks: CheckResult[]): CategoryResult {
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status !== 'pass').length;
  const score = Math.round(
    checks.reduce((sum, c) => sum + c.score, 0) / checks.length
  );

  return {
    name,
    score,
    passed,
    failed,
    checks,
  };
}
