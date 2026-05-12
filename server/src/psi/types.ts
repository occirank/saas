/**
 * PageSpeed Insights API v5 Types
 * Based on Google PageSpeed Insights API documentation
 */

// Core Web Vitals metrics from CrUX data
export interface CoreWebVitals {
  lcp: {
    value: number;
    unit: string;
    score: 'good' | 'needs-improvement' | 'poor';
    percentile: number;
  };
  inp: {
    value: number;
    unit: string;
    score: 'good' | 'needs-improvement' | 'poor';
    percentile: number;
  };
  cls: {
    value: number;
    unit: string;
    score: 'good' | 'needs-improvement' | 'poor';
    percentile: number;
  };
  fcp?: {
    value: number;
    unit: string;
    score: 'good' | 'needs-improvement' | 'poor';
    percentile: number;
  };
  ttfb?: {
    value: number;
    unit: string;
    score: 'good' | 'needs-improvement' | 'poor';
    percentile: number;
  };
}

// Lighthouse category scores (0-100)
export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

// Individual audit item from Lighthouse
export interface LighthouseAuditItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: 'binary' | 'numeric' | 'manual' | 'notApplicable' | 'informative';
  displayValue?: string;
  numericValue?: number;
  details?: {
    type: string;
    items?: Record<string, unknown>[];
    summary?: Record<string, unknown>;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
  };
}

// Lighthouse audit categories
export interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
  auditRefs: {
    id: string;
    weight: number;
    group?: string;
  }[];
}

// Full Lighthouse result
export interface LighthouseResult {
  requestedUrl: string;
  finalUrl: string;
  fetchTime: string;
  userAgent: string;
  categories: {
    'performance': LighthouseCategory;
    'accessibility': LighthouseCategory;
    'best-practices': LighthouseCategory;
    'seo': LighthouseCategory;
  };
  audits: Record<string, LighthouseAuditItem>;
}

// PSI API response structure
export interface PSIApiResponse {
  kind: string;
  id: string;
  loadingExperience?: {
    id: string;
    metrics: {
      'CUMULATIVE_LAYOUT_SHIFT_SCORE'?: CruxMetric;
      'FIRST_CONTENTFUL_PAINT_MS'?: CruxMetric;
      'INTERACTION_TO_NEXT_PAINT'?: CruxMetric;
      'LARGEST_CONTENTFUL_PAINT_MS'?: CruxMetric;
      'EXPERIMENTAL_TIME_TO_FIRST_BYTE'?: CruxMetric;
      'TOTAL_BLOCKING_TIME_TIME'?: CruxMetric;
    } & Record<string, CruxMetric>;
    overall_category: string;
  };
  originLoadingExperience?: {
    id: string;
    metrics: Record<string, CruxMetric>;
    overall_category: string;
  };
  lighthouseResult: LighthouseResult;
  analysisUTCTimestamp: string;
}

// CrUX metric structure
export interface CruxMetric {
  category: string;
  distributions: Array<{
    min: number;
    max: number;
    proportion: number;
  }>;
  percentile: number;
}

// OcciRank PSI result format
export interface PSIResult {
  url: string;
  timestamp: string;
  mobile: DeviceResult;
  desktop: DeviceResult;
  overallScore: number;
}

// Per-device result
export interface DeviceResult {
  scores: LighthouseScores;
  coreWebVitals: CoreWebVitals;
  audits: LighthouseAuditItem[];
  opportunities: LighthouseAuditItem[];
  diagnostics: LighthouseAuditItem[];
  passedAudits: LighthouseAuditItem[];
  failedAudits: LighthouseAuditItem[];
  lighthouseVersion: string;
  fetchTime: string;
  finalUrl: string;
}

// Options for running PSI audit
export interface PSIAuditOptions {
  url: string;
  categories?: ('performance' | 'accessibility' | 'best-practices' | 'seo')[];
  strategy?: 'mobile' | 'desktop';
  locale?: string;
}

// PSI service configuration
export interface PSIConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}
