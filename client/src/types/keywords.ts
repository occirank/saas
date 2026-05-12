export interface KeywordProject {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Keyword {
  id: string;
  projectId: string;
  keyword: string;
  targetUrl: string | null;
  searchEngine: 'google' | 'bing';
  location: string;
  device: 'desktop' | 'mobile';
  language: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface KeywordRanking {
  id: string;
  keywordId: string;
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  urlFound: string | null;
  title?: string | null;
  searchVolume: number | null;
  difficulty: number | null;
  checkedAt: string | null;
}

export interface KeywordWithRanking extends Keyword {
  latestRanking?: KeywordRanking;
}

export interface ProjectWithKeywords extends KeywordProject {
  keywordCount: number;
  keywords: KeywordWithRanking[];
}

export interface CreateKeywordRequest {
  projectId: string;
  keyword: string;
  targetUrl?: string;
  searchEngine?: 'google' | 'bing';
  location?: string;
  device?: 'desktop' | 'mobile';
  language?: string;
}

export interface CreateProjectRequest {
  name: string;
  domain: string;
}

export interface RankCheckResult {
  keyword: string;
  domain: string;
  position: number | null;
  url: string | null;
  title: string | null;
  description: string | null;
  resultCount: number;
  checkedAt: Date;
}

export interface RankingHistory {
  id: string;
  keywordId: string;
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  urlFound: string | null;
  searchVolume: number | null;
  difficulty: number | null;
  checkedAt: string;
}
