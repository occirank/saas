export interface GSCSite {
  siteUrl: string;
  permissionLevel: 'siteOwner' | 'siteFullUser' | 'siteRestrictedUser' | 'siteUnverifiedUser';
}

export interface GSCSearchQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  totalQueries: number;
  totalPages: number;
  totalCountries?: number;
  totalDevices?: number;
}

export interface GSCDailyData {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCCountryData {
  country: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCDeviceData {
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCAnalyticsResult {
  siteUrl: string;
  startDate: string;
  endDate: string;
  queries: GSCSearchQuery[];
  pages: GSCPageData[];
  countries: GSCCountryData[];
  devices: GSCDeviceData[];
  daily: GSCDailyData[];
  summary: GSCSummary;
}

export interface GSCConnectionStatus {
  connected: boolean;
  configured: boolean;
  hasTokens?: boolean;
  sites?: GSCSite[];
  error?: string;
}

export interface GSCSitemap {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  errors: number;
  warnings: number;
  contents: GSCSitemapContent[];
}

export interface GSCSitemapContent {
  type: 'web' | 'image' | 'video' | 'news';
  submitted: number;
  indexed?: number;
}

export interface GSCIndexStatus {
  url: string;
  verdict: 'NEUTRAL' | 'VERIFIED' | 'PASS' | 'DEPRECATED' | 'ERROR';
  coverageState?: string;
  robotsTxtState?: string;
  sitemapState?: string;
  lastCrawlTime?: string;
  indexingState?: string;
  pageFetchState?: string;
}

export interface GSCAuthResponse {
  authUrl: string;
  state: string;
}

export interface GSCBulkIndexStatus {
  url: string;
  isIndexed: boolean;
  verdict: 'NEUTRAL' | 'VERIFIED' | 'PASS' | 'DEPRECATED' | 'ERROR';
  coverageState?: string;
  lastCrawlTime?: string;
  error?: string;
  clicks?: number;
  impressions?: number;
  position?: number;
}

export interface GSCBulkIndexResult {
  siteUrl: string;
  results: GSCBulkIndexStatus[];
  summary: {
    total: number;
    indexed: number;
    notIndexed: number;
    errors: number;
  };
  fetchedAt: string;
}
