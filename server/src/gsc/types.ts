/**
 * Google Search Console API Types
 */

export interface GSCCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GSCTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  tokenType: string;
  scope: string;
}

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

export interface GSCDailyData {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCDataRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSearchAnalyticsResponse {
  rows: GSCDataRow[];
  responseAggregationType: 'auto' | 'byPage' | 'byProperty' | 'byNewsShowcasePanel';
}

export interface GSCSearchAnalyticsRequest {
  startDate: string;
  endDate: string;
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'searchAppearance')[];
  dimensionFilterGroups?: GSCDimensionFilterGroup[];
  rowLimit?: number;
  startRow?: number;
  aggregationType?: 'auto' | 'byPage' | 'byProperty';
  dataState?: 'all' | 'final';
}

export interface GSCDimensionFilterGroup {
  filters: GSCDimensionFilter[];
  groupType: 'and' | 'or';
}

export interface GSCDimensionFilter {
  dimension: 'query' | 'page' | 'country' | 'device' | 'searchAppearance';
  operator?: 'contains' | 'equals' | 'notEquals' | 'includingRegex' | 'excludingRegex';
  expression: string;
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

export interface GSCSummary {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  totalQueries: number;
  totalPages: number;
}

export interface GSCConnectionStatus {
  connected: boolean;
  hasTokens: boolean;
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

export interface GSCSitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export interface GSCSitemapWithUrls extends GSCSitemap {
  urls: GSCSitemapUrl[];
}

  export interface GSCBulkIndexStatus {
  url: string;
  isIndexed: boolean;
  verdict: 'NEUTRAL' | 'VERIFIED' | 'PASS' | 'DEPRECATED' | 'ERROR';
  coverageState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  error?: string;
  isRateLimited?: boolean;  // True if this URL failed due to rate limiting
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
