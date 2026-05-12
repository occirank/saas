import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { keywords, keywordProjects, keywordRankings, serpResults } from '../db/schema.js';
import { getKeywordService } from '../keywords/keyword-service.js';
import type { CreateProjectRequest, CreateKeywordRequest, ProjectWithKeywords, KeywordWithRanking, RankingHistory } from '../keywords/types.js';

export const keywordRouter = Router();

const keywordService = getKeywordService();

let dbAvailable = false;
const checkDb = async () => {
  try {
    await db.select().from(keywordProjects).limit(1);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
};
checkDb();

// STATUS CHECK
keywordRouter.get('/status', async (_req: Request, res: Response) => {
  res.json({
    configured: keywordService.isConfigured(),
    dbAvailable
  });
});

// PROJECTS

keywordRouter.get('/projects', async (_req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const projects = await keywordService.getProjects();
    res.json(projects);
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

keywordRouter.post('/projects', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { name, domain } = req.body as CreateProjectRequest;
    
    if (!name || !domain) {
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    const project = await keywordService.createProject({ name, domain });
    res.status(201).json(project);
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

keywordRouter.get('/projects/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    const project = await keywordService.getProject(id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Failed to fetch project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

keywordRouter.patch('/projects/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    const { name, domain } = req.body;
    
    const updated = await keywordService.updateProject(id, { name, domain });
    res.json(updated);
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

keywordRouter.delete('/projects/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    await keywordService.deleteProject(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// KEYWORDS

keywordRouter.post('/keywords', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const data = req.body as CreateKeywordRequest;
    
    if (!data.projectId || !data.keyword) {
      return res.status(400).json({ error: 'Project ID and keyword are required' });
    }

    const keyword = await keywordService.addKeyword(data);
    res.status(201).json(keyword);
  } catch (error) {
    console.error('Failed to add keyword:', error);
    res.status(500).json({ error: 'Failed to add keyword' });
  }
});

keywordRouter.get('/keywords/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    const keyword = await keywordService.getKeyword(id);
    
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }
    
    res.json(keyword);
  } catch (error) {
    console.error('Failed to fetch keyword:', error);
    res.status(500).json({ error: 'Failed to fetch keyword' });
  }
});

keywordRouter.delete('/keywords/:id', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    await keywordService.deleteKeyword(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete keyword:', error);
    res.status(500).json({ error: 'Failed to delete keyword' });
  }
});

// RANKING CHECKS

keywordRouter.post('/keywords/:id/check', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!keywordService.isConfigured()) {
    return res.status(503).json({ 
      error: 'HaloScan API not configured',
      hint: 'Set HALOSCAN_API_KEY environment variable'
    });
  }

  try {
    const { id } = req.params;
    const keyword = await keywordService.getKeyword(id);
    
    if (!keyword) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    const [project] = await db.select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, keyword.projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const result = await keywordService.checkKeywordRanking(id, project.domain);
    res.json(result);
  } catch (error) {
    console.error('Failed to check keyword:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

keywordRouter.post('/projects/:id/check-all', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (!keywordService.isConfigured()) {
    return res.status(503).json({ 
      error: 'HaloScan API not configured',
      hint: 'Set HALOSCAN_API_KEY environment variable'
    });
  }

  try {
    const { id } = req.params;
    const results = await keywordService.checkAllProjectKeywords(id);
    res.json({ 
      success: true, 
      checked: results.length,
      results 
    });
  } catch (error) {
    console.error('Failed to check project keywords:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// RANKING HISTORY

keywordRouter.get('/keywords/:id/history', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    const daysQuery = req.query.days;
    const days = typeof daysQuery === 'string' ? parseInt(daysQuery, 10) : 30;
    
    const history = await keywordService.getRankingHistory(id, days);
    res.json(history);
  } catch (error) {
    console.error('Failed to fetch ranking history:', error);
    res.status(500).json({ error: 'Failed to fetch ranking history' });
  }
});

// SERP RESULTS (cached)

keywordRouter.get('/keywords/:id/serp', async (req: Request, res: Response) => {
  if (!dbAvailable) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { id } = req.params;
    
    const results = await db.select()
      .from(serpResults)
      .where(eq(serpResults.keywordId, id))
      .orderBy(serpResults.position);
    
    res.json(results);
  } catch (error) {
    console.error('Failed to fetch SERP results:', error);
    res.status(500).json({ error: 'Failed to fetch SERP results' });
  }
});
