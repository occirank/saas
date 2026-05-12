import { Router, Request, Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { getGSCService } from '../gsc/gsc-service.js';
import type { GSCAnalyticsResult, GSCSite, GSCConnectionStatus, GSCBulkIndexResult } from '../gsc/types.js';
import { db } from '../db/index.js';
import { gscTokens, gscSites, gscAnalytics, gscIndexCache } from '../db/schema.js';
export const gscRouter = Router();

/**
 * Helper to get GSC service with tokens loaded from DB
 */
async function getGSCServiceWithTokens(): Promise<{ service: ReturnType<typeof getGSCService>; connected: boolean }> {
  const service = getGSCService();
  
  if (!service.isConnected() && dbAvailable) {
    const [storedToken] = await db.select().from(gscTokens).limit(1);
    if (storedToken) {
      service.setTokens({
        accessToken: storedToken.accessToken,
        refreshToken: storedToken.refreshToken,
        expiryDate: storedToken.expiryDate,
        tokenType: storedToken.tokenType,
        scope: storedToken.scope || '',
      });
    }
  }
  
  return { service, connected: service.isConnected() };
}

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(gscTokens).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

/**
 * GET /api/gsc/status
 * Check GSC connection status
 */
gscRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const service = getGSCService();
    
    if (!service.isConfigured()) {
      return res.json({
        connected: false,
        configured: false,
        hasTokens: false,
        error: 'GSC credentials not configured. Set GSC_CLIENT_ID and GSC_CLIENT_SECRET environment variables.',
      } as GSCConnectionStatus);
    }

    // Check database for stored tokens
    if (dbAvailable) {
      const [storedToken] = await db.select().from(gscTokens).limit(1);
      if (storedToken) {
        service.setTokens({
          accessToken: storedToken.accessToken,
          refreshToken: storedToken.refreshToken,
          expiryDate: storedToken.expiryDate,
          tokenType: storedToken.tokenType,
          scope: storedToken.scope || '',
        });
      }
    }

    if (!service.isConnected()) {
      return res.json({
        connected: false,
        configured: true,
        hasTokens: false,
      } as GSCConnectionStatus);
    }

    // Get sites if connected
    const sites = await service.getSites();
    
    // Sync sites to database
    if (dbAvailable && sites.length > 0) {
      for (const site of sites) {
        await db.insert(gscSites)
          .values({
            siteUrl: site.siteUrl,
            permissionLevel: site.permissionLevel,
          })
          .onConflictDoUpdate({
            target: gscSites.siteUrl,
            set: {
              permissionLevel: site.permissionLevel,
              updatedAt: new Date(),
            },
          });
      }
    }

    res.json({
      connected: true,
      configured: true,
      hasTokens: true,
      sites,
    } as GSCConnectionStatus);
  } catch (error) {
    console.error('GSC status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.json({
      connected: false,
      configured: true,
      hasTokens: false,
      error: message,
    } as GSCConnectionStatus);
  }
});

/**
 * GET /api/gsc/auth
 * Get OAuth authorization URL
 */
gscRouter.get('/auth', (_req: Request, res: Response) => {
  try {
    const service = getGSCService();
    
    if (!service.isConfigured()) {
      return res.status(400).json({ 
        error: 'GSC not configured. Set GSC_CLIENT_ID and GSC_CLIENT_SECRET environment variables.' 
      });
    }

    const state = Math.random().toString(36).substring(7);
    const authUrl = service.getAuthorizationUrl(state);
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error('GSC auth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/callback
 * OAuth callback endpoint
 */
gscRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      return res.redirect(`http://localhost:5173/gsc?error=${encodeURIComponent(oauthError as string)}`);
    }

    if (!code) {
      return res.redirect('http://localhost:5173/gsc?error=No+authorization+code+received');
    }

    const service = getGSCService();
    const tokens = await service.exchangeCodeForTokens(code as string);

    // Store tokens in database
    if (dbAvailable) {
      // Delete existing tokens first
      await db.delete(gscTokens);
      
      await db.insert(gscTokens).values({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        tokenType: tokens.tokenType,
        scope: tokens.scope,
      });
    }

    res.redirect('http://localhost:5173/gsc?connected=true');
  } catch (error) {
    console.error('GSC callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`http://localhost:5173/gsc?error=${encodeURIComponent(message)}`);
  }
});

/**
 * POST /api/gsc/disconnect
 * Disconnect GSC integration
 */
gscRouter.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const service = getGSCService();
    service.setTokens(null);

    if (dbAvailable) {
      await db.delete(gscTokens);
    }

    res.json({ success: true, message: 'GSC disconnected' });
  } catch (error) {
    console.error('GSC disconnect error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/sites
 * Get all connected GSC sites
 */
gscRouter.get('/sites', async (_req: Request, res: Response) => {
  try {
    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    const sites = await service.getSites();
    res.json(sites);
  } catch (error) {
    console.error('GSC sites error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gsc/analytics
 * Get search analytics for a site
 */
gscRouter.post('/analytics', async (req: Request, res: Response) => {
  try {
    const { siteUrl, startDate, endDate, dimensions, rowLimit, useCache = true } = req.body;

    if (!siteUrl || !startDate || !endDate) {
      return res.status(400).json({ 
        error: 'siteUrl, startDate, and endDate are required' 
      });
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    // Check cache first
    if (dbAvailable && useCache) {
      const [cached] = await db.select()
        .from(gscAnalytics)
        .where(and(
          eq(gscAnalytics.siteUrl, siteUrl),
          eq(gscAnalytics.startDate, startDate),
          eq(gscAnalytics.endDate, endDate)
        ))
        .limit(1);

      // Cache is valid for 1 hour
      if (cached && (Date.now() - cached.createdAt.getTime()) < 60 * 60 * 1000) {
      return res.json(cached.analyticsData as unknown as GSCAnalyticsResult);
      }
    }

    // Fetch fresh data
    const result = await service.getSearchAnalytics(
      siteUrl,
      startDate,
      endDate,
      dimensions || ['query', 'page'],
      rowLimit || 100
    );

    // Cache the result
    if (dbAvailable) {
      await db.insert(gscAnalytics).values({
        siteUrl,
        startDate,
        endDate,
        analyticsData: result as unknown as Record<string, unknown>,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('GSC analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/analytics/:siteUrl
 * Get search analytics for a specific site (with date range query params)
 */
gscRouter.get('/analytics/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const { startDate, endDate, dimensions, rowLimit, useCache } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate query parameters are required' 
      });
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    // Check cache first
    if (dbAvailable && useCache !== 'false') {
      const [cached] = await db.select()
        .from(gscAnalytics)
        .where(and(
          eq(gscAnalytics.siteUrl, decodeURIComponent(siteUrl)),
          eq(gscAnalytics.startDate, startDate as string),
          eq(gscAnalytics.endDate, endDate as string)
        ))
        .limit(1);

      // Cache is valid for 1 hour
      if (cached && (Date.now() - cached.createdAt.getTime()) < 60 * 60 * 1000) {
      return res.json(cached.analyticsData as unknown as GSCAnalyticsResult);
      }
    }

    // Fetch fresh data
    const result = await service.getSearchAnalytics(
      decodeURIComponent(siteUrl),
      startDate as string,
      endDate as string,
      (dimensions as string)?.split(',') as ('query' | 'page' | 'country' | 'device')[] || ['query', 'page'],
      rowLimit ? parseInt(rowLimit as string, 10) : 100
    );

    // Cache the result
    if (dbAvailable) {
      await db.insert(gscAnalytics).values({
        siteUrl: decodeURIComponent(siteUrl),
        startDate: startDate as string,
        endDate: endDate as string,
        analyticsData: result as unknown as Record<string, unknown>,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('GSC analytics error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/sitemaps/:siteUrl
 * Get sitemaps for a site
 */
gscRouter.get('/sitemaps/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    const sitemaps = await service.getSitemaps(decodeURIComponent(siteUrl));
    res.json(sitemaps);
  } catch (error) {
    console.error('GSC sitemaps error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/index-stats/:siteUrl
 * Get index stats from sitemaps (instant, matches GSC dashboard)
 */
gscRouter.get('/index-stats/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    const sitemaps = await service.getSitemaps(decodeURIComponent(siteUrl));
    
    // Sum up submitted and indexed from all sitemaps
    let totalSubmitted = 0;
    let totalIndexed = 0;
    
    for (const sitemap of sitemaps) {
      for (const content of sitemap.contents) {
        totalSubmitted += content.submitted || 0;
        totalIndexed += content.indexed || 0;
      }
    }
    
    res.json({
      siteUrl: decodeURIComponent(siteUrl),
      submitted: totalSubmitted,
      indexed: totalIndexed,
      notIndexed: totalSubmitted - totalIndexed,
      coverage: totalSubmitted > 0 ? Math.round((totalIndexed / totalSubmitted) * 100) : 0,
      sitemaps: sitemaps.map(s => ({
        path: s.path,
        submitted: s.contents.reduce((sum, c) => sum + (c.submitted || 0), 0),
        indexed: s.contents.reduce((sum, c) => sum + (c.indexed || 0), 0),
      })),
    });
  } catch (error) {
    console.error('GSC index stats error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gsc/sitemaps/:siteUrl
 * Submit a sitemap
 */
gscRouter.post('/sitemaps/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const { sitemapPath } = req.body;

    if (!sitemapPath) {
      return res.status(400).json({ error: 'sitemapPath is required' });
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    await service.submitSitemap(decodeURIComponent(siteUrl), sitemapPath);
    res.json({ success: true, message: 'Sitemap submitted' });
  } catch (error) {
    console.error('GSC submit sitemap error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/gsc/sitemaps/:siteUrl
 * Delete a sitemap
 */
gscRouter.delete('/sitemaps/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const { sitemapPath } = req.query;

    if (!sitemapPath) {
      return res.status(400).json({ error: 'sitemapPath query parameter is required' });
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    await service.deleteSitemap(decodeURIComponent(siteUrl), sitemapPath as string);
    res.json({ success: true, message: 'Sitemap deleted' });
  } catch (error) {
    console.error('GSC delete sitemap error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/url-inspection
 * Get indexing status for a URL (including lastCrawlTime)
 */
gscRouter.get('/url-inspection', async (req: Request, res: Response) => {
  try {
    const { url, siteUrl } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url query parameter is required' });
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }
    const status = await service.getUrlIndexingStatus(url as string, siteUrl as string);
    res.json(status);
  } catch (error) {
    console.error('GSC URL inspection error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/gsc/bulk-url-inspection
 * Check index status for multiple URLs
 */
/**
 * GET /api/gsc/index-coverage/:siteUrl
 * Get all pages from analytics (instant - pages with impressions = indexed)
 */
gscRouter.get('/index-coverage/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const { startDate, endDate, rowLimit } = req.query;

    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    const analytics = await service.getSearchAnalytics(
      decodeURIComponent(siteUrl),
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0],
      ['page'],
      rowLimit ? parseInt(rowLimit as string, 10) : 500
    );

    // Pages with impressions = indexed (they appear in search results)
    const results = analytics.pages.map(p => ({
      url: p.page,
      isIndexed: p.impressions > 0,
      verdict: p.impressions > 0 ? 'VERIFIED' as const : 'NEUTRAL' as const,
      coverageState: p.impressions > 0 
        ? `Indexed - ${p.impressions} impressions, ${p.clicks} clicks`
        : 'No impressions in selected period',
      clicks: p.clicks,
      impressions: p.impressions,
      position: p.position,
    }));

    const indexed = results.filter(r => r.isIndexed).length;

    res.json({
      siteUrl: decodeURIComponent(siteUrl),
      results,
      summary: {
        total: results.length,
        indexed,
        notIndexed: results.length - indexed,
        errors: 0,
      },
      fetchedAt: new Date().toISOString(),
    } as GSCBulkIndexResult);
  } catch (error) {
    console.error('GSC index coverage error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/full-index-coverage/:siteUrl
 * Get ALL pages from sitemaps + analytics (fast approach)
 */
gscRouter.get('/full-index-coverage/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const { startDate, endDate } = req.query;

const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 480 * 24 * 60 * 60 * 1000); // 16 months (GSC max)
    
    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    const result = await service.getFullIndexCoverage(
      decodeURIComponent(siteUrl),
      startDate ? start.toISOString().split('T')[0] : undefined,
      endDate ? end.toISOString().split('T')[0] : undefined
    );

    res.json(result as GSCBulkIndexResult);
  } catch (error) {
    console.error('GSC full index coverage error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});


gscRouter.post('/bulk-url-inspection', async (req: Request, res: Response) => {
  try {
    const { urls, siteUrl, concurrency } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls array is required' });
    }

    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required' });
    }

    // Validate URLs
    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: `Invalid URL: ${url}` });
      }
    }

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

const result = await service.getBulkUrlIndexingStatus(
      urls,
      siteUrl,
      concurrency || 10
    );
    res.json(result as GSCBulkIndexResult);
  } catch (error) {
    console.error('GSC bulk URL inspection error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/gsc/accurate-index-coverage/:siteUrl
 * Get accurate index coverage using URL Inspection API (cached for 24 hours)
 */
gscRouter.get('/accurate-index-coverage/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const decodedSiteUrl = decodeURIComponent(siteUrl);
    const forceRefresh = req.query.refresh === 'true';

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    // Check cache first (valid for 24 hours)
    if (dbAvailable && !forceRefresh) {
      const [cached] = await db.select()
        .from(gscIndexCache)
        .where(eq(gscIndexCache.siteUrl, decodedSiteUrl))
        .limit(1);
      
if (cached && (Date.now() - cached.createdAt.getTime()) < 24 * 60 * 60 * 1000) {
        return res.json({
          siteUrl: decodedSiteUrl,
          results: cached.results as unknown as GSCBulkIndexResult['results'],
          summary: cached.summary,
          fetchedAt: cached.createdAt.toISOString(),
          cached: true,
        });
      }
    }

    // Fetch fresh data
    const result = await service.getAccurateIndexCoverage(decodedSiteUrl);
    
    // Cache the result
    if (dbAvailable) {
      await db.insert(gscIndexCache)
        .values({
          siteUrl: decodedSiteUrl,
          results: result.results as unknown as Record<string, unknown>[],
          summary: result.summary,
        })
        .onConflictDoUpdate({
          target: gscIndexCache.siteUrl,
          set: {
            results: result.results as unknown as Record<string, unknown>[],
            summary: result.summary,
            createdAt: new Date(),
          },
        });
    }
    
    res.json({ ...result, cached: false });
  } catch (error) {
    console.error('GSC accurate index coverage error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
/**
 * GET /api/gsc/issues/:siteUrl
 * Get GSC issues (answers to the 16 GSC questions) for a site
 */
gscRouter.get('/issues/:siteUrl', async (req: Request, res: Response) => {
  try {
    const { siteUrl } = req.params;
    const decodedSiteUrl = decodeURIComponent(siteUrl);

    const { service, connected } = await getGSCServiceWithTokens();
    
    if (!connected) {
      return res.status(401).json({ error: 'GSC not connected' });
    }

    console.log(`[GSC Issues] Extracting issues for ${decodedSiteUrl}`);
    const issues = await service.extractGSCIssues(decodedSiteUrl);
    
    // Map issues to question answers
    // Note: answer=true means the site PASSED the check (no issues)
    // answer=false means the site FAILED the check (issue present)
    const questionAnswers: Record<string, { question: string; answer: boolean; details: string }> = {
      Q1: { question: 'Indexing anomalies', answer: !issues.includes('Indexing anomalies'), details: issues.includes('Indexing anomalies') ? 'Indexing anomalies detected' : 'No indexing anomalies' },
      Q2: { question: 'Robots.txt errors/warnings', answer: !issues.some(i => i.includes('Robots.txt')), details: issues.some(i => i.includes('Robots.txt')) ? 'Robots.txt has errors or warnings' : 'Robots.txt OK' },
      Q3: { question: 'Pages blocked by robots.txt', answer: !issues.includes('Blocked by robots.txt'), details: issues.includes('Blocked by robots.txt') ? 'Pages are blocked' : 'No pages blocked' },
      Q4: { question: 'Resources blocked by robots.txt', answer: !issues.includes('Resources blocked by robots.txt'), details: issues.includes('Resources blocked by robots.txt') ? 'Resources are blocked' : 'No resources blocked' },
      Q5: { question: 'Crawl errors', answer: !issues.includes('Crawl errors'), details: issues.includes('Crawl errors') ? 'Crawl errors detected' : 'No crawl errors' },
      Q6: { question: 'Crawl anomalies', answer: !issues.includes('Crawl anomalies'), details: issues.includes('Crawl anomalies') ? 'Crawl anomalies detected' : 'No crawl anomalies' },
      Q7: { question: 'Sitemaps listed in GSC', answer: !issues.includes('Sitemaps not listed'), details: issues.includes('Sitemaps not listed') ? 'No sitemaps submitted' : 'Sitemaps are listed' },
      Q8: { question: 'Sitemap errors/warnings', answer: !issues.some(i => i.includes('Sitemap')), details: issues.filter(i => i.includes('Sitemap')).join(', ') || 'No sitemap issues' },
      Q9: { question: 'Indexing problems for subdomain(s)', answer: !issues.some(i => i.includes('Indexing') || i.includes('Coverage')), details: issues.some(i => i.includes('Indexing') || i.includes('Coverage')) ? 'Indexing problems detected' : 'No indexing problems' },
      Q10: { question: 'GSC property per site', answer: !issues.includes('GSC property not set'), details: issues.includes('GSC property not set') ? 'GSC property not properly configured' : 'GSC property configured' },
      Q11: { question: 'Target country defined', answer: !issues.includes('Target country not set'), details: issues.includes('Target country not set') ? 'Target country not set' : 'Target country configured' },
      Q12: { question: 'Hreflang errors', answer: !issues.includes('Hreflang errors'), details: issues.includes('Hreflang errors') ? 'Hreflang errors detected' : 'No hreflang errors' },
      Q13: { question: 'Site configured in GSC', answer: !issues.includes('GSC not verified'), details: issues.includes('GSC not verified') ? 'Site not verified in GSC' : 'Site verified in GSC' },
      Q14: { question: 'Manual action penalty', answer: !issues.includes('Manual action penalty'), details: issues.includes('Manual action penalty') ? 'Manual action detected' : 'No manual actions' },
      Q15: { question: 'Improvement suggestions', answer: !issues.includes('Improvement suggestions'), details: issues.includes('Improvement suggestions') ? 'Improvements suggested' : 'No improvement suggestions' },
      Q16: { question: 'Security issues', answer: !issues.includes('Security issues'), details: issues.includes('Security issues') ? 'Security issues detected' : 'No security issues' },
    };

    res.json({
      siteUrl: decodedSiteUrl,
      issues,
      issueCount: issues.length,
      questions: questionAnswers,
      summary: {
        pass: Object.values(questionAnswers).filter(q => q.answer).length,
        fail: Object.values(questionAnswers).filter(q => !q.answer).length,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GSC issues error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

