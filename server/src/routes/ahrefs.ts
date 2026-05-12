import { Router, Request, Response } from 'express';
import { getAhrefsProxyService } from '../ahrefs/index.js';
import { runBacklinkChecks } from '../audits/backlink-checks.js';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const service = getAhrefsProxyService();
  const status = service.getStatus();
  res.json(status);
});

router.post('/session', (req: Request, res: Response) => {
  const { proxySession } = req.body;
  
  if (!proxySession) {
    return res.status(400).json({ error: 'proxySession is required' });
  }
  
  const service = getAhrefsProxyService();
  service.setProxySession(proxySession);
  
  res.json({ success: true, message: 'Proxy session configured' });
});

router.get('/analyze/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country } = req.query;
  
  const service = getAhrefsProxyService();
  
  if (!service.isConfigured()) {
    return res.status(503).json({ 
      error: 'Ahrefs proxy not configured',
      hint: 'Set AHREFS_PROXY_SESSION environment variable or POST to /api/ahrefs/session'
    });
  }
  
  try {
    const analysis = await service.getFullAnalysis(domain, country as string);
    res.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/dr/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country } = req.query;
  
  const service = getAhrefsProxyService();
  
  if (!service.isConfigured()) {
    return res.status(503).json({ error: 'Ahrefs proxy not configured' });
  }
  
  try {
    const data = await service.getDomainRating(domain, country as string);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/backlinks/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country } = req.query;
  
  const service = getAhrefsProxyService();
  
  if (!service.isConfigured()) {
    return res.status(503).json({ error: 'Ahrefs proxy not configured' });
  }
  
  try {
    const data = await service.getBacklinksStats(domain, country as string);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/history/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country, timeFrame, grouping } = req.query;
  
  const service = getAhrefsProxyService();
  
  if (!service.isConfigured()) {
    return res.status(503).json({ error: 'Ahrefs proxy not configured' });
  }
  
  try {
    const data = await service.getRefdomainsHistory(
      domain,
      timeFrame as 'month1' | 'month3' | 'month6' | 'year1' | 'year2' | 'all' || 'year1',
      grouping as 'daily' | 'weekly' | 'monthly' || 'weekly',
      country as string
    );
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/check/:domain', async (req: Request, res: Response) => {
  const { domain } = req.params;
  const { country, sfBrokenLinks, sfBacklinks, sfRefdomains } = req.body;
  
  try {
    const results = await runBacklinkChecks({
      domain,
      country,
      sfBrokenLinks,
      sfBacklinks,
      sfRefdomains,
    });
    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export const ahrefsRouter = router;
