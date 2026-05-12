import type { CheerioAPI } from 'cheerio';
import type { SFCrawlResult } from './parsers/sf-parser.js';
import type { PSIResult } from './psi/types.js';

export interface AuditResult {
  url: string;
  timestamp: string;
  overallScore: number;
  categories: CategoryResult[];
}

export interface CategoryResult {
  name: string;
  score: number;
  passed: number;
  failed: number;
  checks: CheckResult[];
}

export interface CheckResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  message: string;
  details?: string;
  value?: string | number;
}

export interface RedirectInfo {
  url: string;
  statusCode: number;
}

export interface AuditContext {
  url: string;
  html: string;
  $: CheerioAPI;
  responseTime: number;
  statusCode: number;
  headers: Record<string, string>;
  robotsTxt?: string;
  sitemapXml?: string;
  redirectChain?: RedirectInfo[];
}

export type AuditCheck = (ctx: AuditContext) => Promise<CheckResult>;

export interface FullAuditResponse {
  id: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  auditType: 'single' | 'crawl' | 'full';
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  overallScore: number;
  sf?: SFCrawlResult;
  psi?: PSIResult;
  audit?: AuditResult;
}
