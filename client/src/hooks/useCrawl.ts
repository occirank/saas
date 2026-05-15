import axios from 'axios';
import type { CrawlJob } from '../types/crawl';
import type { SFCrawlResult } from '../types/sf-result';

export function useCrawl() {
  const startCrawl = async (url: string, options: { maxPages?: number; maxDepth?: number }): Promise<CrawlJob> => {
    const response = await axios.post('/api/crawl/start', { url, ...options });
    const data = response.data;
    return {
      id: data.crawlId,
      url: data.url,
      status: data.status,
      progress: 0,
      startTime: new Date().toISOString(),
    };
  };

  const getCrawlStatus = async (crawlId: string): Promise<CrawlJob> => {
    const response = await axios.get(`/api/crawl/${crawlId}`);
    return response.data;
  };

  const getCrawlResults = async (crawlId: string): Promise<SFCrawlResult> => {
    const response = await axios.post(`/api/crawl/${crawlId}/save`, {
      includePsi: true,
      psiMaxPages: 10,
      psiConcurrency: 2,
      exportToSheets: true,
      createNewSpreadsheet: true,
    });
    return response.data.sf;
  };

  const cancelCrawl = async (crawlId: string): Promise<void> => {
    await axios.delete(`/api/crawl/${crawlId}`);
  };

  const checkStatus = async (): Promise<{ screamingFrog: { available: boolean; error?: string } }> => {
    const response = await axios.get('/api/crawl/status');
    return response.data;
  };

  return { startCrawl, getCrawlStatus, getCrawlResults, cancelCrawl, checkStatus };
}
