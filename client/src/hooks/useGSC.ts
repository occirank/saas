import { useState, useCallback, useEffect } from 'react';
import type {
  GSCConnectionStatus,
  GSCSite,
  GSCAnalyticsResult,
  GSCSitemap,
  GSCIndexStatus,
  GSCAuthResponse,
  GSCBulkIndexResult,
} from '../types/gsc';


interface UseGSCReturn {
  // State
  status: GSCConnectionStatus | null;
  isLoading: boolean;
  error: string | null;
  analytics: GSCAnalyticsResult | null;
  sitemaps: GSCSitemap[];
  bulkIndexResult: GSCBulkIndexResult | null;
  
  // Actions
  checkStatus: () => Promise<GSCConnectionStatus>;
  connect: () => Promise<GSCAuthResponse>;
  disconnect: () => Promise<void>;
  getSites: () => Promise<GSCSite[]>;
  getAnalytics: (siteUrl: string, startDate: string, endDate: string, options?: { rowLimit?: number; useCache?: boolean }) => Promise<GSCAnalyticsResult>;
  getSitemaps: (siteUrl: string) => Promise<GSCSitemap[]>;
  submitSitemap: (siteUrl: string, sitemapPath: string) => Promise<void>;
  deleteSitemap: (siteUrl: string, sitemapPath: string) => Promise<void>;
  getUrlIndexingStatus: (url: string, siteUrl?: string) => Promise<GSCIndexStatus>;
  getBulkUrlIndexingStatus: (urls: string[], siteUrl: string, concurrency?: number) => Promise<GSCBulkIndexResult>;
  getIndexCoverage: (siteUrl: string, startDate?: string, endDate?: string) => Promise<GSCBulkIndexResult>;
  getFullIndexCoverage: (siteUrl: string, startDate?: string, endDate?: string) => Promise<GSCBulkIndexResult>;
  getAccurateIndexCoverage: (siteUrl: string, refresh?: boolean) => Promise<GSCBulkIndexResult & { cached?: boolean }>;
  getIndexStats: (siteUrl: string) => Promise<{ siteUrl: string; submitted: number; indexed: number; notIndexed: number; coverage: number; sitemaps: { path: string; submitted: number; indexed: number }[] }>;
  clearError: () => void;
}

export function useGSC(): UseGSCReturn {
  const [status, setStatus] = useState<GSCConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<GSCAnalyticsResult | null>(null);
  const [sitemaps, setSitemaps] = useState<GSCSitemap[]>([]);
  const [bulkIndexResult, setBulkIndexResult] = useState<GSCBulkIndexResult | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const checkStatus = useCallback(async (): Promise<GSCConnectionStatus> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/status');
      const data: GSCConnectionStatus = await response.json();
      setStatus(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to check GSC status';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(async (): Promise<GSCAuthResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/auth');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const data: GSCAuthResponse = await response.json();
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to connect to GSC';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/disconnect', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect');
      }
      setStatus(null);
      setAnalytics(null);
      setSitemaps([]);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to disconnect from GSC';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSites = useCallback(async (): Promise<GSCSite[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/sites');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get sites');
      }
      return response.json();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get GSC sites';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAnalytics = useCallback(async (
    siteUrl: string,
    startDate: string,
    endDate: string,
    options?: { rowLimit?: number; useCache?: boolean }
  ): Promise<GSCAnalyticsResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: options?.rowLimit || 100,
          useCache: options?.useCache !== false,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get analytics');
      }
      const data: GSCAnalyticsResult = await response.json();
      setAnalytics(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get GSC analytics';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSitemaps = useCallback(async (siteUrl: string): Promise<GSCSitemap[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get sitemaps');
      }
      const data: GSCSitemap[] = await response.json();
      setSitemaps(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get sitemaps';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitSitemap = useCallback(async (siteUrl: string, sitemapPath: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sitemapPath }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit sitemap');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to submit sitemap';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSitemap = useCallback(async (siteUrl: string, sitemapPath: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}?sitemapPath=${encodeURIComponent(sitemapPath)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete sitemap');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete sitemap';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getUrlIndexingStatus = useCallback(async (url: string, siteUrl?: string): Promise<GSCIndexStatus> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ url });
      if (siteUrl) params.append('siteUrl', siteUrl);
      const response = await fetch(`/api/gsc/url-inspection?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get URL indexing status');
      }
      return response.json();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get URL indexing status';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getBulkUrlIndexingStatus = useCallback(async (
    urls: string[],
    siteUrl: string,
    concurrency: number = 3
  ): Promise<GSCBulkIndexResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gsc/bulk-url-inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, siteUrl, concurrency }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get bulk URL indexing status');
      }
      const data: GSCBulkIndexResult = await response.json();
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get bulk URL indexing status';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getFullIndexCoverage = useCallback(async (
    siteUrl: string,
    startDate?: string,
    endDate?: string
  ): Promise<GSCBulkIndexResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const queryString = params.toString();
      const url = `/api/gsc/full-index-coverage/${encodeURIComponent(siteUrl)}${queryString ? `?${queryString}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get full index coverage');
      }
      const data: GSCBulkIndexResult = await response.json();
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get full index coverage';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getIndexCoverage = useCallback(async (
    siteUrl: string,
    startDate?: string,
    endDate?: string
  ): Promise<GSCBulkIndexResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gsc/index-coverage/${encodeURIComponent(siteUrl)}?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get index coverage');
      }
      const data: GSCBulkIndexResult = await response.json();
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get index coverage';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);



  const getAccurateIndexCoverage = useCallback(async (
    siteUrl: string,
    refresh: boolean = false
  ): Promise<GSCBulkIndexResult & { cached?: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/gsc/accurate-index-coverage/${encodeURIComponent(siteUrl)}${refresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get accurate index coverage');
      }
      const data = await response.json();
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get accurate index coverage';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getIndexStats = useCallback(async (siteUrl: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/gsc/index-stats/${encodeURIComponent(siteUrl)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get index stats');
      }
      return response.json();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to get index stats';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status on mount
  useEffect(() => {
    checkStatus().catch(() => {
      // Ignore errors on initial check
    });
  }, [checkStatus]);

  return {
    status,
    isLoading,
    error,
    analytics,
    sitemaps,
    bulkIndexResult,
    checkStatus,
    connect,
    disconnect,
    getSites,
    getAnalytics,
    getSitemaps,
    submitSitemap,
    deleteSitemap,
    getUrlIndexingStatus,
    getBulkUrlIndexingStatus,
    getIndexCoverage,
    getFullIndexCoverage,
    getAccurateIndexCoverage,
    getIndexStats,
    clearError,
  };
}
