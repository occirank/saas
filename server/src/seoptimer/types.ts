/**
 * SEOptimer API Types
 */

export interface SEOptimerConfig {
  apiKey: string;
}

export interface SEOptimerCreateReportRequest {
  url: string;
  pdf?: 0 | 1;
  template?: string;
  callback?: string;
}

export interface SEOptimerCreateReportResponse {
  success: boolean;
  data: {
    url: string;
    pdf: boolean;
    callback: boolean;
    template: boolean | string;
    id: string;
  };
  error?: string;
}

export interface SEOptimerAuditData {
  url: string;
  pdf?: string;
  output?: {
    pdf?: string;
    // On-page SEO
    onPage?: SEOptimerOnPageData;
    // Technical SEO
    technical?: SEOptimerTechnicalData;
    // Links
    links?: SEOptimerLinksData;
    // Social
    social?: SEOptimerSocialData;
    // Usability
    usability?: SEOptimerUsabilityData;
    // Performance
    performance?: SEOptimerPerformanceData;
    // Keywords
    keywords?: SEOptimerKeywordsData;
    // Backlinks summary
    backlinks?: SEOptimerBacklinksData;
    // Overall scores
    scores?: SEOptimerScores;
    // Raw data from SEOptimer
    [key: string]: unknown;
  };
  // Store full raw response
  rawData?: Record<string, unknown>;
}

export interface SEOptimerOnPageData {
  titleTag?: {
    status: 'pass' | 'fail' | 'warning';
    value?: string;
    length?: number;
    message?: string;
  };
  metaDescription?: {
    status: 'pass' | 'fail' | 'warning';
    value?: string;
    length?: number;
    message?: string;
  };
  headings?: {
    h1?: {
      status: 'pass' | 'fail' | 'warning';
      count?: number;
      values?: string[];
      message?: string;
    };
    h2?: {
      status: 'pass' | 'fail' | 'warning';
      count?: number;
      message?: string;
    };
  };
  images?: {
    status: 'pass' | 'fail' | 'warning';
    total?: number;
    missingAlt?: number;
    message?: string;
  };
  content?: {
    status: 'pass' | 'fail' | 'warning';
    wordCount?: number;
    message?: string;
  };
  keywordUsage?: {
    status: 'pass' | 'fail' | 'warning';
    density?: number;
    message?: string;
  };
}

export interface SEOptimerTechnicalData {
  https?: {
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  };
  robotsTxt?: {
    status: 'pass' | 'fail' | 'warning';
    exists?: boolean;
    url?: string;
    message?: string;
  };
  sitemap?: {
    status: 'pass' | 'fail' | 'warning';
    exists?: boolean;
    url?: string;
    message?: string;
  };
  urlStructure?: {
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  };
  canonical?: {
    status: 'pass' | 'fail' | 'warning';
    exists?: boolean;
    value?: string;
    message?: string;
  };
  responsive?: {
    status: 'pass' | 'fail' | 'warning';
    isResponsive?: boolean;
    message?: string;
  };
  schema?: {
    status: 'pass' | 'fail' | 'warning';
    hasSchema?: boolean;
    types?: string[];
    message?: string;
  };
}

export interface SEOptimerLinksData {
  internalLinks?: {
    status: 'pass' | 'fail' | 'warning';
    count?: number;
    message?: string;
  };
  externalLinks?: {
    status: 'pass' | 'fail' | 'warning';
    count?: number;
    message?: string;
  };
  brokenLinks?: {
    status: 'pass' | 'fail' | 'warning';
    count?: number;
    urls?: string[];
    message?: string;
  };
}

export interface SEOptimerSocialData {
  ogTags?: {
    status: 'pass' | 'fail' | 'warning';
    hasTitle?: boolean;
    hasDescription?: boolean;
    hasImage?: boolean;
    message?: string;
  };
  twitterCards?: {
    status: 'pass' | 'fail' | 'warning';
    exists?: boolean;
    message?: string;
  };
  socialProfiles?: {
    status: 'pass' | 'fail' | 'warning';
    found?: string[];
    message?: string;
  };
}

export interface SEOptimerUsabilityData {
  favicon?: {
    status: 'pass' | 'fail' | 'warning';
    exists?: boolean;
    message?: string;
  };
  mobileFriendly?: {
    status: 'pass' | 'fail' | 'warning';
    score?: number;
    message?: string;
  };
  fontSize?: {
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  };
  tapTargets?: {
    status: 'pass' | 'fail' | 'warning';
    message?: string;
  };
}

export interface SEOptimerPerformanceData {
  pageSize?: {
    status: 'pass' | 'fail' | 'warning';
    size?: number;
    sizeFormatted?: string;
    message?: string;
  };
  loadTime?: {
    status: 'pass' | 'fail' | 'warning';
    time?: number;
    message?: string;
  };
  requests?: {
    status: 'pass' | 'fail' | 'warning';
    count?: number;
    message?: string;
  };
  compression?: {
    status: 'pass' | 'fail' | 'warning';
    enabled?: boolean;
    message?: string;
  };
  caching?: {
    status: 'pass' | 'fail' | 'warning';
    enabled?: boolean;
    message?: string;
  };
  minification?: {
    status: 'pass' | 'fail' | 'warning';
    js?: boolean;
    css?: boolean;
    message?: string;
  };
}

export interface SEOptimerKeywordsData {
  mainKeywords?: string[];
  topKeywords?: Array<{
    keyword: string;
    count: number;
    density: number;
  }>;
  longTailKeywords?: string[];
}

export interface SEOptimerBacklinksData {
  totalBacklinks?: number;
  referringDomains?: number;
  backlinkQuality?: {
    status: 'pass' | 'fail' | 'warning';
    score?: number;
    message?: string;
  };
  topAnchorText?: string[];
}

export interface SEOptimerScores {
  overall?: number;
  onPage?: number;
  technical?: number;
  performance?: number;
  usability?: number;
  social?: number;
  links?: number;
}

export interface SEOptimerGetReportResponse {
  success: boolean;
  data?: SEOptimerAuditData;
  error?: string;
  message?: string;
}

export interface SEOptimerConnectionStatus {
  connected: boolean;
  configured: boolean;
  error?: string;
  quota?: {
    used: number;
    total: number;
    remaining: number;
  };
}

export interface SEOptimerAuditResult {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data?: SEOptimerAuditData;
  scores?: SEOptimerScores;
  pdfUrl?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface SEOptimerBulkAuditRequest {
  urls: string[];
  pdf?: boolean;
  template?: string;
}

export interface SEOptimerBulkAuditResult {
  results: SEOptimerAuditResult[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
}
