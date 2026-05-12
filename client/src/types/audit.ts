export interface AuditResult {
  id?: string;
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

export type AuditStatus = 'idle' | 'loading' | 'success' | 'error';
