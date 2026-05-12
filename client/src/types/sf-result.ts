export interface SFCrawlResult {
  crawlId?: string;
  url?: string;
  startTime?: string;
  endTime?: string;
  summary: {
    totalPages: number;
    crawledPages: number;
    uniqueDomains: number;
    brokenLinks: number;
    redirects: number;
    avgPageSize: number;
    avgResponseTime: number;
  };
  pages: SFPageData[];
  issues: SFIssue[];
  scores: {
    metaTags: number;
    headings: number;
    images: number;
    links: number;
    technical: number;
    performance: number;
    overall: number;
  };
  psiScores?: PSIScores;
}

export interface SFPageData {
  url: string;
  statusCode: number;
  status?: string;
  contentType?: string;
  indexability?: string;
  indexabilityStatus?: string;
  title?: string;
  titleLength?: number;
  titlePixelWidth?: number;
  metaDescription?: string;
  metaDescriptionLength?: number;
  metaDescriptionPixelWidth?: number;
  metaKeywords?: string;
  metaKeywordsLength?: number;
  h1?: string;
  h1Length?: number;
  h1_2?: string;
  h1_2Length?: number;
  h2_1?: string;
  h2_1Length?: number;
  h2_2?: string;
  h2_2Length?: number;
  metaRobots?: string;
  xRobotsTag?: string;
  metaRefresh?: string;
  canonical?: string;
  relNext?: string;
  relPrev?: string;
  httpRelNext?: string;
  httpRelPrev?: string;
  amphtmlLink?: string;
  pageSize?: number;
  transferred?: number;
  totalTransferred?: number;
  co2?: number;
  carbonFootprint?: string;
  wordCount?: number;
  sentenceCount?: number;
  avgWordsPerSentence?: number;
  fleschReadabilityScore?: number;
  readability?: string;
  textRatio?: number;
  crawlDepth?: number;
  folderDepth?: number;
  linkScore?: number;
  inlinks?: number;
  uniqueInlinks?: number;
  uniqueJSInlinks?: number;
  inlinksPercent?: number;
  outlinks?: number;
  uniqueOutlinks?: number;
  uniqueJSOutlinks?: number;
  externalOutlinks?: number;
  uniqueExternalOutlinks?: number;
  uniqueJSExternalOutlinks?: number;
  nearestDuplicate?: string;
  duplicateCount?: number;
  spellingErrors?: number;
  grammarErrors?: number;
  hash?: string;
  responseTime?: number;
  lastModified?: string;
  redirectUrl?: string;
  redirectType?: string;
  cookies?: string;
  language?: string;
  httpVersion?: string;
  mobileAlternate?: string;
  issues: string[];
  psi?: PagePSIData;
}

export interface PagePSIData {
  mobile: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    coreWebVitals: {
      lcp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      inp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      cls: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
    };
  };
  desktop: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
    coreWebVitals: {
      lcp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      inp: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
      cls: { value: number; score: 'good' | 'needs-improvement' | 'poor' };
    };
  };
  overallScore: number;
}

export interface PSIScores {
  avgMobilePerformance: number;
  avgDesktopPerformance: number;
  avgOverallPerformance: number;
  coreWebVitalsPassRate: number;
  pagesWithPSI: number;
}

export interface SFIssue {
  type: 'error' | 'warning' | 'notice';
  category: string;
  message: string;
  url?: string;
  count?: number;
}
