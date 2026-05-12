export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CrawlJob {
  id: string;
  url: string;
  status: CrawlStatus;
  progress: number;
  startTime: string;
  endTime?: string;
  error?: string;
  outputDir?: string;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  maxThreads?: number;
}
