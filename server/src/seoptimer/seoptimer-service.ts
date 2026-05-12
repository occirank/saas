import type {
  SEOptimerConfig,
  SEOptimerCreateReportRequest,
  SEOptimerCreateReportResponse,
  SEOptimerGetReportResponse,
  SEOptimerAuditData,
  SEOptimerConnectionStatus,
  SEOptimerAuditResult,
  SEOptimerScores,
} from './types.js';

const SEOPTIMER_API_BASE = 'https://api.seoptimer.com/v1';

let seoptimerServiceInstance: SEOptimerService | null = null;

export function getSEOptimerService(): SEOptimerService {
  if (!seoptimerServiceInstance) {
    seoptimerServiceInstance = new SEOptimerService();
  }
  return seoptimerServiceInstance;
}

export class SEOptimerService {
  private config: SEOptimerConfig;

  constructor() {
    this.config = {
      apiKey: process.env.SEOPTIMER_API_KEY || '',
    };
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.config.apiKey) {
      throw new Error('SEOptimer API key not configured. Set SEOPTIMER_API_KEY environment variable.');
    }

    const response = await fetch(`${SEOPTIMER_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SEOptimer API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async createReport(
    url: string,
    options: { pdf?: boolean; template?: string } = {}
  ): Promise<SEOptimerCreateReportResponse> {
    const body: SEOptimerCreateReportRequest = {
      url,
      pdf: options.pdf ? 1 : 0,
      ...(options.template && { template: options.template }),
    };

    return this.makeApiRequest<SEOptimerCreateReportResponse>(
      '/report/create',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  }

  async getReport(reportId: string): Promise<SEOptimerGetReportResponse> {
    return this.makeApiRequest<SEOptimerGetReportResponse>(
      `/report/get/${reportId}`
    );
  }

  async createAuditAndWait(
    url: string,
    options: { pdf?: boolean; template?: string; maxWaitMs?: number } = {}
  ): Promise<SEOptimerAuditResult> {
    const maxWaitMs = options.maxWaitMs || 60000;
    const pollInterval = 2000;
    const startTime = Date.now();

    const createResponse = await this.createReport(url, {
      pdf: options.pdf,
      template: options.template,
    });

    if (!createResponse.success) {
      return {
        id: '',
        url,
        status: 'failed',
        error: createResponse.error || 'Failed to create report',
        createdAt: new Date().toISOString(),
      };
    }

    const reportId = createResponse.data.id;
    const result: SEOptimerAuditResult = {
      id: reportId,
      url,
      status: 'processing',
      createdAt: new Date().toISOString(),
    };

    while (Date.now() - startTime < maxWaitMs) {
      const reportResponse = await this.getReport(reportId);

      if (reportResponse.success && reportResponse.data) {
        result.status = 'completed';
        result.data = reportResponse.data;
        result.scores = this.extractScores(reportResponse.data);
        result.pdfUrl = reportResponse.data.output?.pdf;
        result.completedAt = new Date().toISOString();
        return result;
      }

      if (reportResponse.message?.includes('processing') || !reportResponse.success) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (reportResponse.error) {
        result.status = 'failed';
        result.error = reportResponse.error;
        return result;
      }
    }

    result.status = 'pending';
    result.error = 'Audit timed out';
    return result;
  }

  private extractScores(data: SEOptimerAuditData): SEOptimerScores | undefined {
    if (data.output?.scores) {
      return data.output.scores;
    }
    
    const rawData = data.rawData || data;
    if (rawData && typeof rawData === 'object' && 'scores' in rawData) {
      return rawData.scores as SEOptimerScores;
    }

    return undefined;
  }

  async checkStatus(): Promise<SEOptimerConnectionStatus> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        configured: false,
        error: 'SEOptimer API key not configured. Set SEOPTIMER_API_KEY environment variable.',
      };
    }

    try {
      const response = await fetch(`${SEOPTIMER_API_BASE}/report/get/test-connection`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
      });

      if (response.status === 401 || response.status === 403) {
        return {
          connected: false,
          configured: true,
          error: 'Invalid API key or unauthorized access',
        };
      }

      return {
        connected: true,
        configured: true,
      };
    } catch (error) {
      return {
        connected: false,
        configured: true,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async bulkAudit(
    urls: string[],
    options: { pdf?: boolean; template?: string; concurrency?: number } = {}
  ): Promise<SEOptimerAuditResult[]> {
    const concurrency = options.concurrency || 3;
    const results: SEOptimerAuditResult[] = [];

    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(url => 
          this.createAuditAndWait(url, options).catch(error => ({
            id: '',
            url,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            createdAt: new Date().toISOString(),
          }))
        )
      );

      results.push(...batchResults);
    }

    return results;
  }
}
