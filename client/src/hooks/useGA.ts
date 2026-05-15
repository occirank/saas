import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type {
  GAConnectionStatus,
  GAProperty,
  GAAnalyticsResult,
  GAAuthResponse,
  GARealtimeData,
} from '../types/ga';

interface UseGAReturn {
  // State
  status: GAConnectionStatus | null;
  isLoading: boolean;
  error: string | null;
  analytics: GAAnalyticsResult | null;
  realtime: GARealtimeData | null;
  properties: GAProperty[];
  
  // Actions
  checkStatus: () => Promise<GAConnectionStatus>;
  connect: () => Promise<GAAuthResponse>;
  disconnect: () => Promise<void>;
  getProperties: () => Promise<GAProperty[]>;
  getAnalytics: (propertyId: string, startDate: string, endDate: string, options?: { useCache?: boolean }) => Promise<GAAnalyticsResult>;
  getRealtime: (propertyId: string) => Promise<GARealtimeData>;
  clearError: () => void;
}

export function useGA(): UseGAReturn {
  const [status, setStatus] = useState<GAConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<GAAnalyticsResult | null>(null);
  const [realtime, setRealtime] = useState<GARealtimeData | null>(null);
  const [properties, setProperties] = useState<GAProperty[]>([]);

  const clearError = useCallback(() => setError(null), []);

  const checkStatus = useCallback(async (): Promise<GAConnectionStatus> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<GAConnectionStatus>('/api/ga/status');
      const data = response.data;
      setStatus(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to check GA status';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connect = useCallback(async (): Promise<GAAuthResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<GAAuthResponse>('/api/ga/auth');
      const data = response.data;

      // Open popup for OAuth
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        'GA OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      return new Promise((resolve, reject) => {
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            // Check status after popup closes
            checkStatus()
              .then((status) => {
                if (status.connected) {
                  resolve(data);
                } else {
                  reject(new Error('Authentication failed'));
                }
              })
              .catch(() => reject(new Error('Failed to verify connection')));
          }
        }, 500);
      });
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to connect to GA';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [checkStatus]);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await axios.post('/api/ga/disconnect');
      setStatus(null);
      setAnalytics(null);
      setProperties([]);
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to disconnect from GA';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getProperties = useCallback(async (): Promise<GAProperty[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<GAProperty[]>('/api/ga/properties');
      const data = response.data;
      setProperties(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get GA properties';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAnalytics = useCallback(async (
    propertyId: string,
    startDate: string,
    endDate: string,
    options?: { useCache?: boolean }
  ): Promise<GAAnalyticsResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post<GAAnalyticsResult>('/api/ga/analytics', {
        propertyId,
        startDate,
        endDate,
        useCache: options?.useCache !== false,
      });
      const data = response.data;
      setAnalytics(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get GA analytics';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getRealtime = useCallback(async (propertyId: string): Promise<GARealtimeData> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<GARealtimeData>(`/api/ga/realtime/${encodeURIComponent(propertyId)}`);
      const data = response.data;
      setRealtime(data);
      return data;
    } catch (e) {
      const message = axios.isAxiosError(e)
        ? e.response?.data?.error || e.message
        : e instanceof Error ? e.message : 'Failed to get GA realtime data';
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
    properties,
    realtime,
    checkStatus,
    connect,
    disconnect,
    getProperties,
    getAnalytics,
    getRealtime,
    clearError,
  };
}
