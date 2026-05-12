import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { getSEOptimerService } from '../seoptimer/seoptimer-service.js';
import type { SEOptimerConnectionStatus, SEOptimerAuditResult, SEOptimerAuditData } from '../seoptimer/types.js';
import { db } from '../db/index.js';
import { seoptimerCache } from '../db/schema.js';

export const seoptimerRouter = Router();

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(seoptimerCache).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

seoptimerRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const service = getSEOptimerService();
    
    if (!service.isConfigured()) {
      return res.json({
        connected: false,
        configured: false,
        error: 'SEOptimer API key not configured. Set SEOPTIMER_API_KEY environment variable.',
      } as SEOptimerConnectionStatus);
    }

    const status = await service.checkStatus();
    res.json(status);
  } catch (error) {
    console.error('SEOptimer status error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.json({
      connected: false,
      configured: true,
      error: message,
    } as SEOptimerConnectionStatus);
  }
});

seoptimerRouter.post('/audit', async (req: Request, res: Response) => {
  try {
    const { url, pdf, template, useCache = true } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const service = getSEOptimerService();
    
    if (!service.isConfigured()) {
      return res.status(400).json({ 
        error: 'SEOptimer not configured. Set SEOPTIMER_API_KEY environment variable.' 
      });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (dbAvailable && useCache) {
      const [cached] = await db.select()
        .from(seoptimerCache)
        .where(eq(seoptimerCache.url, url))
        .limit(1);

      if (cached && (Date.now() - cached.createdAt.getTime()) < 24 * 60 * 60 * 1000) {
        return res.json({
          ...cached.auditData,
          cached: true,
        } as SEOptimerAuditResult & { cached: boolean });
      }
    }

    const result = await service.createAuditAndWait(url, {
      pdf: pdf === true,
      template,
    });

    if (result.status === 'completed' && dbAvailable) {
      await db.insert(seoptimerCache)
        .values({
          url,
          reportId: result.id,
          auditData: result as unknown as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: seoptimerCache.url,
          set: {
            reportId: result.id,
            auditData: result as unknown as Record<string, unknown>,
            createdAt: new Date(),
          },
        });
    }

    res.json({ ...result, cached: false });
  } catch (error) {
    console.error('SEOptimer audit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

seoptimerRouter.get('/audit/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const service = getSEOptimerService();
    
    if (!service.isConfigured()) {
      return res.status(400).json({ 
        error: 'SEOptimer not configured. Set SEOPTIMER_API_KEY environment variable.' 
      });
    }

    const reportResponse = await service.getReport(reportId);

    if (!reportResponse.success) {
      return res.status(404).json({ 
        error: reportResponse.error || reportResponse.message || 'Report not found or still processing' 
      });
    }

    res.json({
      id: reportId,
      status: 'completed',
      data: reportResponse.data,
      scores: reportResponse.data?.output?.scores,
      pdfUrl: reportResponse.data?.output?.pdf,
      completedAt: new Date().toISOString(),
    } as SEOptimerAuditResult);
  } catch (error) {
    console.error('SEOptimer get report error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

seoptimerRouter.post('/bulk-audit', async (req: Request, res: Response) => {
  try {
    const { urls, pdf, template, concurrency } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'urls array is required' });
    }

    const service = getSEOptimerService();
    
    if (!service.isConfigured()) {
      return res.status(400).json({ 
        error: 'SEOptimer not configured. Set SEOPTIMER_API_KEY environment variable.' 
      });
    }

    for (const url of urls) {
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: `Invalid URL: ${url}` });
      }
    }

    const results = await service.bulkAudit(urls, {
      pdf: pdf === true,
      template,
      concurrency: concurrency || 3,
    });

    const summary = {
      total: results.length,
      completed: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      pending: results.filter(r => r.status === 'pending' || r.status === 'processing').length,
    };

    res.json({ results, summary });
  } catch (error) {
    console.error('SEOptimer bulk audit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

seoptimerRouter.get('/cache/:url', async (req: Request, res: Response) => {
  try {
    const { url } = req.params;
    const decodedUrl = decodeURIComponent(url);

    if (!dbAvailable) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const [cached] = await db.select()
      .from(seoptimerCache)
      .where(eq(seoptimerCache.url, decodedUrl))
      .limit(1);

    if (!cached) {
      return res.status(404).json({ error: 'No cached audit found for this URL' });
    }

    const isExpired = (Date.now() - cached.createdAt.getTime()) > 24 * 60 * 60 * 1000;

    res.json({
      ...cached.auditData,
      cached: true,
      expired: isExpired,
      cachedAt: cached.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('SEOptimer cache error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

seoptimerRouter.delete('/cache/:url', async (req: Request, res: Response) => {
  try {
    const { url } = req.params;
    const decodedUrl = decodeURIComponent(url);

    if (!dbAvailable) {
      return res.status(503).json({ error: 'Database not available' });
    }

    await db.delete(seoptimerCache).where(eq(seoptimerCache.url, decodedUrl));

    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('SEOptimer clear cache error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
