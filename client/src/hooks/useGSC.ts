import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
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
      const response = await axios.get<GSCConnectionStatus>('/api/gsc/status');
      const data = response.data;
      setStatus(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to check GSC status';
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
      const response = await axios.get<GSCAuthResponse>('/api/gsc/auth');
      return response.data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to connect to GSC';
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
      await axios.post('/api/gsc/disconnect');
      setStatus(null);
      setAnalytics(null);
      setSitemaps([]);
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to disconnect from GSC';
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
      const response = await axios.get<GSCSite[]>('/api/gsc/sites');
      return response.data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get GSC sites';
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
      const response = await axios.post<GSCAnalyticsResult>('/api/gsc/analytics', {
        siteUrl,
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: options?.rowLimit || 100,
        useCache: options?.useCache !== false,
      });
      const data = response.data;
      setAnalytics(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get GSC analytics';
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
      const response = await axios.get<GSCSitemap[]>(`/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}`);
      const data = response.data;
      setSitemaps(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get sitemaps';
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
      await axios.post(`/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}`, { sitemapPath });
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to submit sitemap';
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
      await axios.delete(
        `/api/gsc/sitemaps/${encodeURIComponent(siteUrl)}?sitemapPath=${encodeURIComponent(sitemapPath)}`
      );
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to delete sitemap';
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
      const response = await axios.get<GSCIndexStatus>(`/api/gsc/url-inspection?${params.toString()}`);
      return response.data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get URL indexing status';
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
      const response = await axios.post<GSCBulkIndexResult>('/api/gsc/bulk-url-inspection', {
        urls,
        siteUrl,
        concurrency,
      });
      const data = response.data;
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get bulk URL indexing status';
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
      const response = await axios.get<GSCBulkIndexResult>(url);
      const data = response.data;
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get full index coverage';
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
      
      const response = await axios.get<GSCBulkIndexResult>(`/api/gsc/index-coverage/${encodeURIComponent(siteUrl)}?${params.toString()}`);
      const data = response.data;
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get index coverage';
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
      const response = await axios.get<GSCBulkIndexResult & { cached?: boolean }>(url);
      const data = response.data;
      setBulkIndexResult(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get accurate index coverage';
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
      const response = await axios.get(`/api/gsc/index-stats/${encodeURIComponent(siteUrl)}`);
      return response.data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get index stats';
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
