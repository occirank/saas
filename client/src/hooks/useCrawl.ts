import type { CrawlJob } from '../types/crawl';
import type { SFCrawlResult } from '../types/sf-result';

export function useCrawl() {
  const startCrawl = async (url: string, options: { maxPages?: number; maxDepth?: number }): Promise<CrawlJob> => {
    const response = await fetch('/api/crawl/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ...options }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start crawl');
    }

    const data = await response.json();
    // Map server response (crawlId) to client expected format (id)
    return {
      id: data.crawlId,
      url: data.url,
      status: data.status,
      progress: 0,
      startTime: new Date().toISOString(),
    };
  };

  const getCrawlStatus = async (crawlId: string): Promise<CrawlJob> => {
    const response = await fetch(`/api/crawl/${crawlId}`);
    if (!response.ok) {
      throw new Error('Failed to get crawl status');
    }
    return response.json();
  };

  const getCrawlResults = async (crawlId: string): Promise<SFCrawlResult> => {
    const response = await fetch(`/api/crawl/${crawlId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        includePsi: true, 
        psiMaxPages: 10, 
        psiConcurrency: 2,
        exportToSheets: true,
        createNewSpreadsheet: true
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get crawl results');
    }
    const data = await response.json();
    return data.sf;
  };

  const cancelCrawl = async (crawlId: string): Promise<void> => {
    const response = await fetch(`/api/crawl/${crawlId}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to cancel crawl');
    }
  };

  const checkStatus = async (): Promise<{ screamingFrog: { available: boolean; error?: string } }> => {
    const response = await fetch('/api/crawl/status');
    return response.json();
  };

  return { startCrawl, getCrawlStatus, getCrawlResults, cancelCrawl, checkStatus };
}
