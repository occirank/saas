export interface SerpApiResponse {
  success: boolean;
  keyword: string;
  parsed_data: {
    safe_search: boolean;
    keyword: string;
    result_count: number;
    organic: SerpOrganicResult[];
    news?: SerpNewsResult[];
    images?: SerpImageResult[];
    videos?: SerpVideoResult[];
  };
}

// HaloScan API response types
export interface HaloScanApiResponse {
  keyword: string;
  serp?: {
    response_time?: string;
    keyword?: string;
    response_code?: number | null;
    failure_reason?: string | null;
    result_count?: number;
    results?: {
      serp_date?: string;
      serp?: HaloScanSerpResult[];
    };
  };
  seo_metrics?: {
    results_count?: number;
    allintitle_count?: number;
    volume?: number;
    keyword_visibility_index?: number;
    keyword_count?: number;
    kgr?: number;
  };
  ads_metrics?: {
    keyword_id?: string;
    search_date?: string;
    volume?: number;
    cpc?: number;
    competition?: number;
    provider_id?: number;
    impressions?: number;
  };
}

export interface HaloScanSerpResult {
  position: number;
  url: string;
  title: string;
  domain?: string;
  description?: string;
  dvi?: number;
  domain_gmb_bl?: number;
  rdvi?: number;
  root_domain_gmb_bl?: number;
}

export interface HaloScanSerpResult {
  position: number;
  url: string;
  title: string;
  domain?: string;
  description?: string;
  is_ad?: boolean;
}

export interface SerpOrganicResult {
  position: number;
  url: string;
  title: string;
  description: string;
  is_video: boolean;
  video_duration?: string;
}

export interface SerpNewsResult {
  position: number;
  url: string;
  title: string;
  description: string;
  source?: string;
  date?: string;
}

export interface SerpImageResult {
  position: number;
  url: string;
  title: string;
  source?: string;
}

export interface SerpVideoResult {
  position: number;
  url: string;
  title: string;
  description: string;
  duration?: string;
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

export interface KeywordWithRanking {
  id: string;
  projectId: string;
  keyword: string;
  targetUrl: string | null;
  searchEngine: string;
  location: string;
  device: string;
  language: string;
  isActive: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
  latestRanking?: {
    position: number | null;
    previousPosition: number | null;
    change: number | null;
    searchVolume: number | null;
    difficulty: number | null;
    urlFound: string | null;
    checkedAt: Date;
  };
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

export interface ProjectWithKeywords {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  keywordCount: number;
  keywords: KeywordWithRanking[];
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
  checkedAt: Date;
}
