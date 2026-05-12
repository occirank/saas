import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

export interface AuditListItem {
  id: string;
  url: string;
  overallScore: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  auditType: 'single' | 'crawl';
  startTime: string;
  endTime: string;
  createdAt: string;
}

export function useAudits() {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get<AuditListItem[]>('/api/audits');
      setAudits(response.data);
    } catch (err) {
      const message = axios.isAxiosError(err) 
        ? err.response?.data?.error || err.message 
        : 'Failed to fetch audits';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAudit = useCallback(async (id: string) => {
    try {
      await axios.delete(`/api/audits/${id}`);
      setAudits(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      console.error('Failed to delete audit:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  return { audits, loading, error, fetchAudits, deleteAudit };
}
