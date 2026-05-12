import type {
  AhrefsProxyConfig,
  AhrefsInputArgs,
  AhrefsInputWithChart,
  AhrefsResponse,
  AhrefsDomainRatingData,
  AhrefsBacklinksStatsData,
  AhrefsPageInfoData,
  AhrefsRefdomainsHistoryData,
  AhrefsMetricsHistoryData,
  BacklinkAnalysisResult,
  AhrefsServiceStatus,
  RefdomainsHistoryPoint,
} from './types.js';

const DEFAULT_CONFIG: Partial<AhrefsProxyConfig> = {
  baseUrl: 'https://ah.sommaserver.click/v4/',
  originalHost: 'app.ahrefs.com',
};

class AhrefsProxyService {
  private proxySession: string | null = null;
  private baseUrl: string;
  private originalHost: string;
  private lastRequest: Date | null = null;
  private lastError: string | null = null;

  constructor() {
    this.proxySession = process.env.AHREFS_PROXY_SESSION || null;
    this.baseUrl = process.env.AHREFS_PROXY_URL || DEFAULT_CONFIG.baseUrl!;
    this.originalHost = DEFAULT_CONFIG.originalHost!;
  }

  isConfigured(): boolean {
    return !!this.proxySession;
  }

  setProxySession(session: string): void {
    this.proxySession = session;
    this.lastError = null;
  }

  getStatus(): AhrefsServiceStatus {
    return {
      configured: this.isConfigured(),
      proxySessionValid: this.lastError === null,
      lastRequest: this.lastRequest || undefined,
      error: this.lastError || undefined,
    };
  }

  private buildInputArgs(domain: string, country: string = 'fr'): AhrefsInputArgs {
    const normalizedDomain = domain.endsWith('/') ? domain : `${domain}/`;
    
    return {
      mode: 'subdomains',
      protocol: 'both',
      url: normalizedDomain,
      multiTarget: ['Single', {
        target: normalizedDomain,
        mode: 'subdomains',
        protocol: 'both',
      }],
      compareDate: null,
      country,
      backlinksFilter: null,
      best_links_filter: 'showAll',
      competitors: [],
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    input: AhrefsInputArgs | AhrefsInputWithChart
  ): Promise<T> {
    if (!this.proxySession) {
      throw new Error('Ahrefs proxy session not configured. Set AHREFS_PROXY_SESSION env var.');
    }

    const encodedInput = encodeURIComponent(JSON.stringify(input));
    const url = `${this.baseUrl}${endpoint}?input=${encodedInput}&original-host=${this.originalHost}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cookie': `proxy-session=${this.proxySession}`,
          'User-Agent': 'Occirank/1.0',
        },
      });

      this.lastRequest = new Date();

      if (!response.ok) {
        const errorText = await response.text();
        this.lastError = `HTTP ${response.status}: ${errorText}`;
        throw new Error(this.lastError);
      }

      const data = await response.json() as AhrefsResponse<T>;
      
      if (data[0] === 'Error') {
        const errorMsg = data[1]?.join(': ') || 'Unknown Ahrefs error';
        this.lastError = errorMsg;
        throw new Error(`Ahrefs API error: ${errorMsg}`);
      }

      this.lastError = null;
      return data[1];
    } catch (error) {
      if (error instanceof Error) {
        this.lastError = error.message;
      }
      throw error;
    }
  }

  async getDomainRating(domain: string, country?: string): Promise<AhrefsDomainRatingData> {
    const input = this.buildInputArgs(domain, country);
    return this.makeRequest<AhrefsDomainRatingData>('seGetDomainRating', input);
  }

  async getBacklinksStats(domain: string, country?: string): Promise<AhrefsBacklinksStatsData> {
    const input = this.buildInputArgs(domain, country);
    return this.makeRequest<AhrefsBacklinksStatsData>('seBacklinksStats', input);
  }

  async getPageInfo(domain: string, country?: string): Promise<AhrefsPageInfoData> {
    const input = this.buildInputArgs(domain, country);
    return this.makeRequest<AhrefsPageInfoData>('seGetPageInfo', input);
  }

  async getRefdomainsHistory(
    domain: string,
    timeFrame: 'month1' | 'month3' | 'month6' | 'year1' | 'year2' | 'all' = 'year1',
    grouping: 'daily' | 'weekly' | 'monthly' = 'weekly',
    country?: string
  ): Promise<AhrefsRefdomainsHistoryData> {
    const args = this.buildInputArgs(domain, country);
    const input: AhrefsInputWithChart = {
      args,
      params: {
        filter: null,
        size: 0,
        offset: 0,
        order_by: null,
        shape: null,
        timeout: null,
      },
      chart: {
        timeFrame,
        grouping,
      },
    };
    return this.makeRequest<AhrefsRefdomainsHistoryData>('seRefdomainsHistory', input);
  }

  async getMetricsHistory(
    domain: string,
    timeFrame: 'month1' | 'month3' | 'month6' | 'year1' | 'year2' | 'all' = 'year1',
    grouping: 'daily' | 'weekly' | 'monthly' = 'weekly',
    country?: string
  ): Promise<AhrefsMetricsHistoryData> {
    const args = this.buildInputArgs(domain, country);
    const input: AhrefsInputWithChart = {
      args,
      params: {
        filter: null,
        size: 0,
        offset: 0,
        order_by: null,
        shape: null,
        timeout: null,
      },
      chart: {
        timeFrame,
        grouping,
      },
    };
    return this.makeRequest<AhrefsMetricsHistoryData>('seGetMetricsHistory', input);
  }

  async getFullAnalysis(domain: string, country?: string): Promise<BacklinkAnalysisResult> {
    const results = await Promise.allSettled([
      this.getDomainRating(domain, country),
      this.getBacklinksStats(domain, country),
      this.getPageInfo(domain, country),
      this.getRefdomainsHistory(domain, 'year1', 'weekly', country),
    ]);

    const domainRating = results[0].status === 'fulfilled' ? results[0].value : null;
    const backlinksStats = results[1].status === 'fulfilled' ? results[1].value : null;
    const pageInfo = results[2].status === 'fulfilled' ? results[2].value : null;
    const refdomainsHistory = results[3].status === 'fulfilled' ? results[3].value : null;

    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason)
      .join('; ');

    return {
      domainRating: domainRating?.domainRating?.value || 0,
      ahrefsRank: domainRating?.ahrefsRank?.value || 0,
      totalBacklinks: backlinksStats?.backlinks || 0,
      dofollowBacklinks: backlinksStats?.backlinksDofollow || 0,
      nofollowBacklinks: backlinksStats?.backlinksNofollow || 0,
      totalRefdomains: backlinksStats?.refdomains || 0,
      dofollowRefdomains: backlinksStats?.refdomainsDofollow || 0,
      nofollowRefdomains: backlinksStats?.refdomainsNofollow || 0,
      refdomainsHistory: refdomainsHistory?.history || [],
      organicTraffic: pageInfo?.organicTraffic || 0,
      organicKeywords: pageInfo?.organicKeywords || 0,
      analyzedAt: new Date(),
      error: errors || undefined,
    };
  }
}

let ahrefsProxyServiceInstance: AhrefsProxyService | null = null;

export function getAhrefsProxyService(): AhrefsProxyService {
  if (!ahrefsProxyServiceInstance) {
    ahrefsProxyServiceInstance = new AhrefsProxyService();
  }
  return ahrefsProxyServiceInstance;
}

export { AhrefsProxyService };
