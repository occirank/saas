export interface AhrefsProxyConfig {
  proxySession: string;
  baseUrl: string;
  originalHost: string;
}

export interface AhrefsInputArgs {
  mode: 'subdomains' | 'prefix' | 'domain' | 'exact';
  protocol: 'both' | 'http' | 'https';
  url: string;
  multiTarget: ['Single', {
    target: string;
    mode: string;
    protocol: string;
  }];
  compareDate: null;
  country: string;
  backlinksFilter: null;
  best_links_filter: 'showAll';
  competitors: [];
}

export interface AhrefsChartParams {
  timeFrame: 'month1' | 'month3' | 'month6' | 'year1' | 'year2' | 'all';
  grouping: 'daily' | 'weekly' | 'monthly';
}

export interface AhrefsInputWithChart {
  args: AhrefsInputArgs;
  params?: {
    filter: null;
    size: number;
    offset: number;
    order_by: null;
    shape: null;
    timeout: null;
  };
  chart?: AhrefsChartParams;
}

export type AhrefsResponse<T> = ['Ok', T] | ['Error', [string, string]];

export interface AhrefsDomainRatingData {
  ahrefsRank: { value: number; delta: number | null };
  domainRating: { value: number; delta: number | null };
}

export interface AhrefsUrlRatingData {
  urlRating: { value: number; delta: number | null };
}

export interface AhrefsPageInfoData {
  organicTraffic: number;
  organicKeywords: number;
  organicTrafficValue: number;
  paidTraffic: number;
  paidKeywords: number;
  paidTrafficValue: number;
}

export interface AhrefsBacklinksStatsData {
  backlinks: number;
  backlinksDofollow: number;
  backlinksNofollow: number;
  refdomains: number;
  refdomainsDofollow: number;
  refdomainsNofollow: number;
  dofollowRatio: number;
}

export interface AhrefsAICitationsData {
  aiOverview: number;
  chatGPT: number;
  perplexity: number;
  gemini: number;
  copilot: number;
}

export interface RefdomainsHistoryPoint {
  date: string;
  refdomains: number;
  refdomainsDofollow: number;
  refdomainsNofollow: number;
}

export interface AhrefsRefdomainsHistoryData {
  history: RefdomainsHistoryPoint[];
}

export interface MetricsHistoryPoint {
  date: string;
  organicTraffic: number;
  organicKeywords: number;
  backlinks: number;
  refdomains: number;
  domainRating: number;
}

export interface AhrefsMetricsHistoryData {
  history: MetricsHistoryPoint[];
}

export interface MetricsByCountryItem {
  country: string;
  organicTraffic: number;
  organicKeywords: number;
  paidTraffic: number;
  paidKeywords: number;
}

export interface AhrefsMetricsByCountryData {
  countries: MetricsByCountryItem[];
}

export interface BacklinkAnalysisResult {
  domainRating: number;
  ahrefsRank: number;
  totalBacklinks: number;
  dofollowBacklinks: number;
  nofollowBacklinks: number;
  totalRefdomains: number;
  dofollowRefdomains: number;
  nofollowRefdomains: number;
  refdomainsHistory: RefdomainsHistoryPoint[];
  organicTraffic: number;
  organicKeywords: number;
  analyzedAt: Date;
  error?: string;
}

export interface BacklinkCheckResult {
  questionId: string;
  question: string;
  answer: 'yes' | 'no' | 'partial' | 'unknown';
  status: 'pass' | 'fail' | 'warning' | 'info';
  score: number;
  details: string;
  metrics?: Record<string, number | string>;
  recommendation?: string;
}

export interface TrendAnalysis {
  direction: 'positive' | 'negative' | 'stable';
  slope: number;
  percentChange: number;
  hasSpike: boolean;
  hasDrop: boolean;
  hasSpikeDrop: boolean;
  spikeDate?: string;
  dropDate?: string;
  spikePercent?: number;
  dropPercent?: number;
}

export interface TldDistribution {
  tld: string;
  count: number;
  percentage: number;
  isLocalMatch: boolean;
}

export interface TldAnalysisResult {
  totalDomains: number;
  localTld: string;
  localTldPercentage: number;
  mismatchPercentage: number;
  distribution: TldDistribution[];
  warning: boolean;
}

export interface AhrefsServiceStatus {
  configured: boolean;
  proxySessionValid: boolean;
  lastRequest?: Date;
  error?: string;
}
