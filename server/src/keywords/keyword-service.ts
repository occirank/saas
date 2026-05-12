import type { 
  SerpApiResponse, 
  SerpOrganicResult, 
  RankCheckResult,
  CreateKeywordRequest,
  CreateProjectRequest,
  KeywordWithRanking,
  ProjectWithKeywords,
  RankingHistory,
  HaloScanApiResponse
} from './types.js';
import { db } from '../db/index.js';
import { 
  keywordProjects, 
  keywords, 
  keywordRankings, 
  serpResults,
  type NewKeywordProject,
  type NewKeyword,
  type NewKeywordRanking,
  type NewSerpResult
} from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export class KeywordService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.HALOSCAN_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchSerpData(
    keyword: string,
    _options: {
      location?: string;
      language?: string;
      device?: string;
    } = {}
  ): Promise<SerpApiResponse> {
    if (!this.apiKey) {
      throw new Error('HaloScan API key not configured');
    }

    const response = await fetch('https://api.haloscan.com/api/keywords/overview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'haloscan-api-key': this.apiKey
      },
      body: JSON.stringify({
        keyword,
        requested_data: ['serp', 'metrics']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HaloScan API error: ${response.status} - ${errorText}`);
    }

    const haloData = await response.json() as HaloScanApiResponse;
    return this.mapHaloScanToSerpResponse(haloData, keyword);
  }

  private mapHaloScanToSerpResponse(haloData: HaloScanApiResponse, keyword: string): SerpApiResponse {
    console.log('[KeywordService] HaloScan raw response:', JSON.stringify(haloData, null, 2));
    
    const serpResults = haloData.serp?.results?.serp;
    if (!serpResults || !Array.isArray(serpResults)) {
      console.log('[KeywordService] No valid serp.results in response, returning empty');
      return {
        success: true,
        keyword,
        parsed_data: {
          safe_search: false,
          keyword,
          result_count: haloData.serp?.result_count || 0,
          organic: []
        }
      };
    }

    const organicResults: SerpOrganicResult[] = serpResults.map((result) => ({
      position: result.position,
      url: result.url,
      title: result.title,
      description: result.description || '',
      is_video: false
    }));

    return {
      success: true,
      keyword,
      parsed_data: {
        safe_search: false,
        keyword,
        result_count: haloData.serp?.result_count || organicResults.length,
        organic: organicResults
      }
    };
  }

  findDomainPosition(
    serpData: SerpApiResponse, 
    domain: string
  ): { result: SerpOrganicResult | null; position: number | null } {
    const normalizedDomain = this.normalizeDomain(domain);
    
    for (const result of serpData.parsed_data.organic) {
      const resultDomain = this.normalizeDomain(result.url);
      if (resultDomain === normalizedDomain || resultDomain.endsWith(`.${normalizedDomain}`)) {
        return { result, position: result.position };
      }
    }

    return { result: null, position: null };
  }

  private normalizeDomain(urlOrDomain: string): string {
    let domain = urlOrDomain.toLowerCase();
    
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      try {
        domain = new URL(urlOrDomain).hostname;
      } catch {
        domain = domain.replace(/^https?:\/\//, '').split('/')[0];
      }
    }
    
    return domain.replace(/^www\./, '');
  }

  async checkKeywordRanking(
    keywordId: string,
    domain: string,
    options: {
      location?: string;
      language?: string;
      device?: string;
    } = {}
  ): Promise<RankCheckResult> {
    const [keyword] = await db.select().from(keywords).where(eq(keywords.id, keywordId));
    
    if (!keyword) {
      throw new Error('Keyword not found');
    }

    console.log(`[KeywordService] Checking "${keyword.keyword}" for domain "${domain}"`);

    const serpData = await this.fetchSerpData(keyword.keyword, {
      location: options.location || keyword.location,
      language: options.language || keyword.language,
      device: options.device || keyword.device
    });

    console.log(`[KeywordService] SERP results count: ${serpData.parsed_data.organic.length}`);
    if (serpData.parsed_data.organic.length > 0) {
      console.log('[KeywordService] Top 5 results:', serpData.parsed_data.organic.slice(0, 5).map(r => ({
        position: r.position,
        domain: this.normalizeDomain(r.url),
        url: r.url
      })));
    }

    const { result, position } = this.findDomainPosition(serpData, domain);
    console.log(`[KeywordService] Found position: ${position} for domain "${this.normalizeDomain(domain)}"`);

    await this.cacheSerpResults(keywordId, serpData.parsed_data.organic);

    const latestRanking = await this.getLatestRanking(keywordId);
    
    const rankingData: NewKeywordRanking = {
      keywordId,
      position,
      previousPosition: latestRanking?.position ?? null,
      urlFound: result?.url ?? null,
      title: result?.title ?? null,
      description: result?.description ?? null,
      searchVolume: null,
      difficulty: null,
      resultCount: serpData.parsed_data.result_count
    };

    await db.insert(keywordRankings).values(rankingData);

    await db.update(keywords)
      .set({ lastCheckedAt: new Date() })
      .where(eq(keywords.id, keywordId));

    return {
      keyword: keyword.keyword,
      domain,
      position,
      url: result?.url ?? null,
      title: result?.title ?? null,
      description: result?.description ?? null,
      resultCount: serpData.parsed_data.result_count,
      checkedAt: new Date()
    };
  }

  private async cacheSerpResults(keywordId: string, organicResults: SerpOrganicResult[]): Promise<void> {
    const records: NewSerpResult[] = organicResults.map(result => ({
      keywordId,
      position: result.position,
      url: result.url,
      title: result.title,
      description: result.description,
      domain: this.extractDomain(result.url),
      isVideo: result.is_video,
      videoDuration: result.video_duration
    }));

    if (records.length > 0) {
      await db.delete(serpResults).where(eq(serpResults.keywordId, keywordId));
      await db.insert(serpResults).values(records);
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[0] || url;
    }
  }

  private async getLatestRanking(keywordId: string) {
    const results = await db.select()
      .from(keywordRankings)
      .where(eq(keywordRankings.keywordId, keywordId))
      .orderBy(desc(keywordRankings.checkedAt))
      .limit(1);
    return results[0] ?? null;
  }

  async createProject(data: CreateProjectRequest) {
    const [project] = await db.insert(keywordProjects)
      .values({
        name: data.name,
        domain: this.normalizeDomain(data.domain)
      })
      .returning();
    return project;
  }

  async getProjects(): Promise<ProjectWithKeywords[]> {
    const projects = await db.select().from(keywordProjects).orderBy(desc(keywordProjects.createdAt));
    
    const projectsWithKeywords: ProjectWithKeywords[] = [];
    
    for (const project of projects) {
      const projectKeywords = await this.getKeywordsByProject(project.id);
      projectsWithKeywords.push({
        ...project,
        keywordCount: projectKeywords.length,
        keywords: projectKeywords
      });
    }

    return projectsWithKeywords;
  }

  async getProject(projectId: string): Promise<ProjectWithKeywords | null> {
    const [project] = await db.select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, projectId));

    if (!project) return null;

    const projectKeywords = await this.getKeywordsByProject(project.id);
    
    return {
      ...project,
      keywordCount: projectKeywords.length,
      keywords: projectKeywords
    };
  }

  async updateProject(projectId: string, data: { name?: string; domain?: string }) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name) updateData.name = data.name;
    if (data.domain) updateData.domain = this.normalizeDomain(data.domain);

    const [updated] = await db.update(keywordProjects)
      .set(updateData)
      .where(eq(keywordProjects.id, projectId))
      .returning();
    return updated;
  }

  async deleteProject(projectId: string): Promise<void> {
    await db.delete(keywordProjects).where(eq(keywordProjects.id, projectId));
  }

  async addKeyword(data: CreateKeywordRequest) {
    const [keyword] = await db.insert(keywords)
      .values({
        projectId: data.projectId,
        keyword: data.keyword,
        targetUrl: data.targetUrl ?? null,
        searchEngine: data.searchEngine ?? 'google',
        location: data.location ?? 'us',
        device: data.device ?? 'desktop',
        language: data.language ?? 'en'
      })
      .returning();
    return keyword;
  }

  async getKeywordsByProject(projectId: string): Promise<KeywordWithRanking[]> {
    const keywordList = await db.select()
      .from(keywords)
      .where(and(
        eq(keywords.projectId, projectId),
        eq(keywords.isActive, true)
      ))
      .orderBy(desc(keywords.createdAt));

    const results: KeywordWithRanking[] = [];

    for (const keyword of keywordList) {
      const latestRanking = await this.getLatestRanking(keyword.id);
      
      results.push({
        ...keyword,
        latestRanking: latestRanking ? {
          position: latestRanking.position,
          previousPosition: latestRanking.previousPosition,
          change: latestRanking.previousPosition !== null && latestRanking.position !== null
            ? latestRanking.previousPosition - latestRanking.position
            : null,
          searchVolume: latestRanking.searchVolume,
          difficulty: latestRanking.difficulty,
          urlFound: latestRanking.urlFound,
          checkedAt: latestRanking.checkedAt
        } : undefined
      });
    }

    return results;
  }

  async getKeyword(keywordId: string): Promise<KeywordWithRanking | null> {
    const [keyword] = await db.select()
      .from(keywords)
      .where(eq(keywords.id, keywordId));

    if (!keyword) return null;

    const latestRanking = await this.getLatestRanking(keyword.id);

    return {
      ...keyword,
      latestRanking: latestRanking ? {
        position: latestRanking.position,
        previousPosition: latestRanking.previousPosition,
        change: latestRanking.previousPosition !== null && latestRanking.position !== null
          ? latestRanking.previousPosition - latestRanking.position
          : null,
        searchVolume: latestRanking.searchVolume,
        difficulty: latestRanking.difficulty,
        urlFound: latestRanking.urlFound,
        checkedAt: latestRanking.checkedAt
      } : undefined
    };
  }

  async deleteKeyword(keywordId: string): Promise<void> {
    await db.delete(keywords).where(eq(keywords.id, keywordId));
  }

  async getRankingHistory(keywordId: string, days: number = 30): Promise<RankingHistory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const rankings = await db.select()
      .from(keywordRankings)
      .where(eq(keywordRankings.keywordId, keywordId))
      .orderBy(desc(keywordRankings.checkedAt));

    return rankings.map(r => ({
      id: r.id,
      keywordId: r.keywordId,
      position: r.position,
      previousPosition: r.previousPosition,
      change: r.previousPosition !== null && r.position !== null
        ? r.previousPosition - r.position
        : null,
      urlFound: r.urlFound,
      searchVolume: r.searchVolume,
      difficulty: r.difficulty,
      checkedAt: r.checkedAt
    }));
  }

  async checkAllProjectKeywords(projectId: string): Promise<RankCheckResult[]> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const results: RankCheckResult[] = [];

    for (const keyword of project.keywords) {
      try {
        const result = await this.checkKeywordRanking(keyword.id, project.domain, {
          location: keyword.location,
          language: keyword.language,
          device: keyword.device
        });
        results.push(result);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to check keyword ${keyword.keyword}:`, error);
      }
    }

    return results;
  }
}

export function getKeywordService() {
  return new KeywordService();
}
