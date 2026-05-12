import { useState, useCallback } from 'react';
import axios from 'axios';
import type { AuditResult, AuditStatus } from '../types/audit';

export function useAudit() {
  const [status, setStatus] = useState<AuditStatus>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async (url: string) => {
    setStatus('loading');
    setError(null);
    setResult(null);

    try {
      const response = await axios.post<AuditResult>('/api/audit', { url });
      setResult(response.data);
      setStatus('success');
    } catch (err) {
      const message = axios.isAxiosError(err) 
        ? err.response?.data?.error || err.message 
        : 'An unexpected error occurred';
      setError(message);
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, runAudit, reset };
}
