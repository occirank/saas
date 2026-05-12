/**
 * Google Analytics 4 API Types
 */

export interface GACredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GATokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  tokenType: string;
  scope: string;
}

export interface GAProperty {
  propertyId: string;
  propertyName: string;
  accountName: string;
  websiteUrl: string;
  createTime?: string;
}

export interface GAConnectionStatus {
  connected: boolean;
  configured: boolean;
  hasTokens?: boolean;
  properties?: GAProperty[];
  error?: string;
}

export interface GAAuthResponse {
  authUrl: string;
  state: string;
}

// Analytics Data API types (raw API response format)
export interface GARow {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}
export interface GAReportRequest {
  propertyId: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions?: string[];
  limit?: number;
  offset?: number;
}

export interface GAReportResponse {
  rows?: GARow[];
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rowCount?: number;
}
// Aggregated analytics result
export interface GAAnalyticsResult {
  propertyId: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  overview: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    eventsPerSession: number;
  };
  daily: GADailyData[];
  topPages: GAPageData[];
  topSources: GASourceData[];
  topCountries: GACountryData[];
  topDevices: GADeviceData[];
  topBrowsers: GABrowserData[];
  realtime: GARealtimeData;
}

export interface GADailyData {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

export interface GAPageData {
  page: string;
  pageviews: number;
  uniquePageviews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
}

export interface GASourceData {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  bounceRate: number;
  conversions: number;
}

export interface GACountryData {
  country: string;
  sessions: number;
  users: number;
  bounceRate: number;
}

export interface GADeviceData {
  device: string;
  sessions: number;
  users: number;
  bounceRate: number;
}

export interface GABrowserData {
  browser: string;
  sessions: number;
  users: number;
}

export interface GARealtimeData {
  activeUsers: number;
  byPage: { page: string; activeUsers: number }[];
  byCountry: { country: string; activeUsers: number }[];
  byDevice: { device: string; activeUsers: number }[];
  bySource: { source: string; activeUsers: number }[];
}

// Comparison data
export interface GAComparisonResult extends GAAnalyticsResult {
  previousPeriod?: {
    overview: GAAnalyticsResult['overview'];
    change: {
      sessions: number;
      users: number;
      pageviews: number;
      bounceRate: number;
      avgSessionDuration: number;
    };
  };
}
