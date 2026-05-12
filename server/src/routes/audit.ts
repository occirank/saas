import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { runFullAudit } from '../audits/index.js';
import { db } from '../db/index.js';
import { audits } from '../db/schema.js';
import type { AuditResult, FullAuditResponse } from '../types.js';
import type { SFCrawlResult } from '../parsers/sf-parser.js';
import { getPSIService } from '../psi/psi-service.js';
import { parsePSIResult } from '../psi/psi-parser.js';
import type { PSIResult } from '../psi/types.js';

export const auditRouter = Router();

// Check if database is available
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

auditRouter.post('/audit', async (req: Request, res: Response) => {
  try {
    const { url, includePsi = false } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const startTime = new Date();
    const auditPromise = runFullAudit(targetUrl.href);
    const psiPromise = includePsi
      ? getPSIService().runFullAudit(targetUrl.href).then(r => parsePSIResult(targetUrl.href, r.mobile, r.desktop)).catch(e => {
          console.error('PSI audit failed:', e);
          return undefined;
        })
      : Promise.resolve(undefined);

    const [result, psiResult] = await Promise.all([auditPromise, psiPromise]);

    const overallScore = psiResult
      ? Math.round((result.overallScore + psiResult.overallScore) / 2)
      : result.overallScore;

    if (dbAvailable) {
      try {
        const auditData: Record<string, unknown> = {
          audit: result,
          ...(psiResult && { psi: psiResult }),
        };

        const [saved] = await db.insert(audits).values({
          url: result.url,
          overallScore,
          status: 'completed',
          auditType: includePsi ? 'full' : 'single',
          startTime,
          endTime: new Date(),
          auditData,
        }).returning();

        res.json({
          id: saved.id,
          url: saved.url,
          status: saved.status,
          auditType: saved.auditType,
          startTime: saved.startTime,
          endTime: saved.endTime,
          audit: result,
          psi: psiResult,
          overallScore,
        } as FullAuditResponse);
        return;
      } catch (dbError) {
        console.error('Failed to save audit to database:', dbError);
      }
    }

    res.json({
      ...result,
      psi: psiResult,
      overallScore,
    });
  } catch (error) {
    console.error('Audit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/audits
 * List all saved audits
 */
auditRouter.get('/audits', async (_req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available',
      hint: 'Set up PostgreSQL with DATABASE_URL environment variable'
    });
  }

  try {
    const allAudits = await db
      .select({
        id: audits.id,
        url: audits.url,
        overallScore: audits.overallScore,
        status: audits.status,
        auditType: audits.auditType,
        startTime: audits.startTime,
        endTime: audits.endTime,
        createdAt: audits.createdAt,
      })
      .from(audits)
      .orderBy(desc(audits.createdAt))
      .limit(100);

    res.json(allAudits);
  } catch (error) {
    console.error('Failed to fetch audits:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

auditRouter.get('/audits/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available',
      hint: 'Set up PostgreSQL with DATABASE_URL environment variable'
    });
  }

  const { id } = req.params;

  try {
    const [audit] = await db
      .select()
      .from(audits)
      .where(eq(audits.id, id))
      .limit(1);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const auditData = audit.auditData as Record<string, unknown>;
    
    if (auditData.pages && Array.isArray(auditData.pages)) {
      const filteredPages = auditData.pages.filter((page: { contentType?: string }) => {
        const ct = page.contentType;
        if (!ct) return true;
        return ct.toLowerCase().includes('text/html');
      });
      auditData.pages = filteredPages;
      if (auditData.summary && typeof auditData.summary === 'object') {
        (auditData.summary as Record<string, unknown>).totalPages = filteredPages.length;
        (auditData.summary as Record<string, unknown>).crawledPages = filteredPages.length;
      }
    }

    const sf = auditData.sf ? auditData.sf as SFCrawlResult : undefined;
    const psi = auditData.psi ? auditData.psi as PSIResult : undefined;
    const auditResult = auditData.audit ? auditData.audit as AuditResult : undefined;

    const isLegacy = !sf && !psi && !auditResult;
    
    const response: FullAuditResponse = {
      id: audit.id,
      url: audit.url,
      status: audit.status,
      auditType: audit.auditType,
      startTime: audit.startTime,
      endTime: audit.endTime,
      createdAt: audit.createdAt,
      overallScore: audit.overallScore,
      ...(sf && { sf }),
      ...(psi && { psi }),
      ...(auditResult && { audit: auditResult }),
      ...(isLegacy && auditData),
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to fetch audit:', error);
    res.status(500).json({ error: 'Failed to fetch audit' });
  }
});

auditRouter.delete('/audits/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available' 
    });
  }

  const { id } = req.params;

  try {
    const [deleted] = await db
      .delete(audits)
      .where(eq(audits.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json({ success: true, message: 'Audit deleted' });
  } catch (error) {
    console.error('Failed to delete audit:', error);
    res.status(500).json({ error: 'Failed to delete audit' });
  }
});

auditRouter.post('/audit/psi', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const startTime = new Date();
    const psiService = getPSIService();
    
    const { mobile, desktop } = await psiService.runFullAudit(targetUrl.href);
    const psiResult = parsePSIResult(targetUrl.href, mobile, desktop);

    if (dbAvailable) {
      try {
        const auditData: Record<string, unknown> = {
          psi: psiResult,
        };

        const [saved] = await db.insert(audits).values({
          url: targetUrl.href,
          overallScore: psiResult.overallScore,
          status: 'completed',
          auditType: 'single',
          startTime,
          endTime: new Date(),
          auditData,
        }).returning();

        res.json({
          id: saved.id,
          url: saved.url,
          status: saved.status,
          auditType: saved.auditType,
          startTime: saved.startTime,
          endTime: saved.endTime,
          psi: psiResult,
          overallScore: psiResult.overallScore,
        } as FullAuditResponse);
        return;
      } catch (dbError) {
        console.error('Failed to save PSI audit to database:', dbError);
      }
    }

    res.json({
      url: targetUrl.href,
      psi: psiResult,
      overallScore: psiResult.overallScore,
    });
  } catch (error) {
    console.error('PSI audit error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: message });
  }
});

auditRouter.post('/audits/:id/psi', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available',
      hint: 'Set up PostgreSQL with DATABASE_URL environment variable'
    });
  }

  const { id } = req.params;

  try {
    const [audit] = await db
      .select()
      .from(audits)
      .where(eq(audits.id, id))
      .limit(1);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const psiService = getPSIService();
    const { mobile, desktop } = await psiService.runFullAudit(audit.url);
    const psiResult = parsePSIResult(audit.url, mobile, desktop);

    const existingData = audit.auditData as Record<string, unknown>;
    const updatedData = {
      ...existingData,
      psi: psiResult,
    };

    const newOverallScore = existingData.sf || existingData.audit
      ? Math.round((audit.overallScore + psiResult.overallScore) / 2)
      : psiResult.overallScore;

    const [updated] = await db
      .update(audits)
      .set({
        auditData: updatedData,
        overallScore: newOverallScore,
        endTime: new Date(),
      })
      .where(eq(audits.id, id))
      .returning();

    res.json({
      id: updated.id,
      url: updated.url,
      status: updated.status,
      auditType: updated.auditType,
      startTime: updated.startTime,
      endTime: updated.endTime,
      psi: psiResult,
      overallScore: newOverallScore,
    } as FullAuditResponse);
  } catch (error) {
    console.error('Failed to add PSI to audit:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ error: message });
  }
});

auditRouter.get('/audits/:id/psi', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ 
      error: 'Database not available',
      hint: 'Set up PostgreSQL with DATABASE_URL environment variable'
    });
  }

  const { id } = req.params;

  try {
    const [audit] = await db
      .select()
      .from(audits)
      .where(eq(audits.id, id))
      .limit(1);

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    const auditData = audit.auditData as Record<string, unknown>;
    const psi = auditData.psi as PSIResult | undefined;

    if (!psi) {
      return res.status(404).json({ 
        error: 'PSI data not found for this audit',
        hint: 'Use POST /api/audits/:id/psi to add PSI data'
      });
    }

    res.json({
      id: audit.id,
      url: audit.url,
      psi,
    });
  } catch (error) {
    console.error('Failed to fetch PSI data:', error);
    res.status(500).json({ error: 'Failed to fetch PSI data' });
  }
});
