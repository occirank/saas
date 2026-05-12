import { useState, useEffect } from 'react';
import axios from 'axios';
import type { AuditResult } from '../types/audit';
import type { SFCrawlResult } from '../types/sf-result';

interface SingleAudit {
  id: string;
  auditType: 'single';
  createdAt: string;
  startTime: string;
  endTime: string;
  status: string;
  url: string;
  overallScore: number;
  categories: AuditResult['categories'];
  timestamp: string;
}

interface CrawlAudit {
  id: string;
  auditType: 'crawl';
  createdAt: string;
  startTime: string;
  endTime: string;
  status: string;
  url: string;
  overallScore: number;
  summary: SFCrawlResult['summary'];
  pages: SFCrawlResult['pages'];
  issues: SFCrawlResult['issues'];
  scores: SFCrawlResult['scores'];
  crawlId?: string;
}

type AuditDetail = SingleAudit | CrawlAudit;

interface UseAuditDetailResult {
  audit: AuditDetail | null;
  loading: boolean;
  error: string | null;
}

export function useAuditDetail(id: string | undefined): UseAuditDetailResult {
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    axios.get<AuditDetail>(`/api/audits/${id}`)
      .then(response => {
        setAudit(response.data);
      })
      .catch(err => {
        const message = axios.isAxiosError(err) 
          ? err.response?.data?.error || err.message 
          : 'Failed to fetch audit';
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  return { audit, loading, error };
}

export type { SingleAudit, CrawlAudit, AuditDetail };
