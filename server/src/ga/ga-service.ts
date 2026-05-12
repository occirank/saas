import type {
  GACredentials,
  GATokens,
  GAProperty,
  GAAnalyticsResult,
  GADailyData,
  GAPageData,
  GASourceData,
  GACountryData,
  GADeviceData,
  GABrowserData,
  GARealtimeData,
  GAReportResponse,
} from './types.js';

const GA_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'openid',
];

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GA_ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1alpha';

let gaServiceInstance: GAService | null = null;

export function getGAService(): GAService {
  if (!gaServiceInstance) {
    gaServiceInstance = new GAService();
  }
  return gaServiceInstance;
}

export class GAService {
  private credentials: GACredentials | null = null;
  private tokens: GATokens | null = null;

  constructor() {
    this.credentials = {
      clientId: process.env.GA_CLIENT_ID || '',
      clientSecret: process.env.GA_CLIENT_SECRET || '',
      redirectUri: process.env.GA_REDIRECT_URI || 'http://localhost:3001/api/ga/callback',
    };
  }

  setTokens(tokens: GATokens | null): void {
    this.tokens = tokens;
  }

  getTokens(): GATokens | null {
    return this.tokens;
  }

  isConfigured(): boolean {
    return !!(this.credentials?.clientId && this.credentials?.clientSecret);
  }

  isConnected(): boolean {
    return !!(this.tokens?.accessToken && this.tokens?.refreshToken);
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.credentials?.clientId) {
      throw new Error('GA client ID not configured');
    }

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: this.credentials.redirectUri,
      response_type: 'code',
      scope: GA_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GATokens> {
    if (!this.credentials) {
      throw new Error('GA credentials not configured');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        redirect_uri: this.credentials.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    const tokens: GATokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiryDate: Date.now() + (data.expires_in * 1000),
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };

    this.tokens = tokens;
    return tokens;
  }

  async refreshAccessToken(): Promise<void> {
    if (!this.credentials || !this.tokens?.refreshToken) {
      throw new Error('Cannot refresh token: missing credentials or refresh token');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.tokens.refreshToken,
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    this.tokens = {
      ...this.tokens,
      accessToken: data.access_token,
      expiryDate: Date.now() + (data.expires_in * 1000),
    };
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.tokens?.accessToken) {
      throw new Error('Not authenticated with Google Analytics');
    }

    if (this.tokens.expiryDate < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  private async makeApiRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.ensureValidToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GA API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getProperties(): Promise<GAProperty[]> {
    interface AccountSummary {
      name: string;
      displayName?: string;
      propertySummaries?: Array<{
        property: string;
        displayName?: string;
        propertyType?: string;
      }>;
    }

    interface AccountSummariesResponse {
      accountSummaries?: AccountSummary[];
    }

    // Use AccountSummaries API to get all accounts and their properties
    const response = await this.makeApiRequest<AccountSummariesResponse>(
      `${GA_ADMIN_API_BASE}/accountSummaries?pageSize=100`
    );

    const properties: GAProperty[] = [];

    for (const account of response.accountSummaries || []) {
      const accountName = account.displayName || account.name;
      
      for (const propSummary of account.propertySummaries || []) {
        // property format: "properties/123456789"
        const propertyId = propSummary.property.split('/')[1];
        
        properties.push({
          propertyId,
          propertyName: propSummary.displayName || propertyId,
          accountName,
          websiteUrl: '',
        });
      }
    }

    return properties;
  }

  async getAnalytics(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<GAAnalyticsResult> {
    console.log(`[GA] Fetching analytics for property ${propertyId} from ${startDate} to ${endDate}`);

    // Run all reports in parallel
    const [overviewData, dailyData, pageData, sourceData, countryData, deviceData, browserData, propertyInfo] = await Promise.all([
      // Overview metrics (GA4 basic metrics that always exist)
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers', 'screenPageViews', 'eventCount']),
      // Daily data
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers', 'screenPageViews'], ['date']),
      // Top pages
      this.runReport(propertyId, startDate, endDate, ['screenPageViews', 'sessions'], ['pagePath'], 20),
      // Traffic sources
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers'], ['sessionDefaultChannelGroup'], 10),
      // Countries
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers'], ['countryId'], 10),
      // Devices
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers'], ['deviceCategory'], 10),
      // Browsers
      this.runReport(propertyId, startDate, endDate, ['sessions', 'totalUsers'], ['browser'], 10),
      // Property info
      this.getPropertyInfo(propertyId),
    ]);

    // Debug: log raw overview data
    console.log('[GA] Raw overview data:', JSON.stringify(overviewData, null, 2));
    console.log('[GA] Raw first row metric values:', overviewData.rows?.[0]?.metricValues);

    // Process overview data
    const overview = this.processOverviewData(overviewData);


    // Process daily data
    const daily = this.processDailyData(dailyData);

    // Process page data
    const topPages = this.processPageData(pageData);

    // Process source data
    const topSources = this.processSourceData(sourceData);

    // Process country data
    const topCountries = this.processCountryData(countryData);

    // Process device data
    const topDevices = this.processDeviceData(deviceData);

    // Process browser data
    const topBrowsers = this.processBrowserData(browserData);

    // Get realtime data (don't fail if it errors)
    let realtime: GARealtimeData = {
      activeUsers: 0,
      byPage: [],
      byCountry: [],
      byDevice: [],
      bySource: [],
    };
    try {
      realtime = await this.getRealtimeData(propertyId);
    } catch (e) {
      console.error('[GA] Failed to get realtime data:', e);
    }

    return {
      propertyId,
      propertyName: propertyInfo?.displayName || propertyId,
      startDate,
      endDate,
      overview,
      daily,
      topPages,
      topSources,
      topCountries,
      topDevices,
      topBrowsers,
      realtime,
    };
  }

  private async getPropertyInfo(propertyId: string): Promise<{ displayName?: string } | null> {
    try {
      return await this.makeApiRequest<{ displayName?: string }>(
        `${GA_ADMIN_API_BASE}/properties/${propertyId}`
      );
    } catch {
      return null;
    }
  }

  private async runReport(
    propertyId: string,
    startDate: string,
    endDate: string,
    metrics: string[],
    dimensions: string[] = [],
    limit: number = 100
  ): Promise<GAReportResponse> {
    const requestBody: Record<string, unknown> = {
      dateRanges: [{ startDate, endDate }],
      metrics: metrics.map(m => ({ name: m })),
    };
    
    // Only add dimensions if there are any
    if (dimensions.length > 0) {
      requestBody.dimensions = dimensions.map(d => ({ name: d }));
      requestBody.limit = limit;
    }

    console.log(`[GA] Request to property ${propertyId}:`, JSON.stringify(requestBody, null, 2));

    const response = await this.makeApiRequest<GAReportResponse>(
      `${GA_API_BASE}/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    console.log(`[GA] Response rows count: ${response.rows?.length || 0}`);
    if (response.rows?.length) {
      console.log(`[GA] First row:`, JSON.stringify(response.rows[0], null, 2));
    }

    return response;
  }

  private processOverviewData(data: GAReportResponse): GAAnalyticsResult['overview'] {
    const row = data.rows?.[0];
    return {
      sessions: parseFloat(row?.metricValues?.[0]?.value || '0'),
      users: parseFloat(row?.metricValues?.[1]?.value || '0'),
      newUsers: 0, // Not fetching this anymore
      pageviews: parseFloat(row?.metricValues?.[2]?.value || '0'),
      bounceRate: 0, // Not fetching this anymore
      avgSessionDuration: 0, // Not fetching this anymore
      eventsPerSession: parseFloat(row?.metricValues?.[3]?.value || '0'),
    };
  }
  private processDailyData(data: GAReportResponse): GADailyData[] {
    return (data.rows || []).map(row => ({
      date: row.dimensionValues?.[0]?.value || '',
      sessions: parseFloat(row.metricValues?.[0]?.value || '0'),
      users: parseFloat(row.metricValues?.[1]?.value || '0'),
      pageviews: parseFloat(row.metricValues?.[2]?.value || '0'),
      bounceRate: 0, // Not fetching
      avgSessionDuration: 0, // Not fetching
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  private processPageData(data: GAReportResponse): GAPageData[] {
    return (data.rows || []).map(row => ({
      page: row.dimensionValues?.[0]?.value || '',
      pageviews: parseFloat(row.metricValues?.[0]?.value || '0'),
      uniquePageviews: parseFloat(row.metricValues?.[1]?.value || '0'),
      avgTimeOnPage: 0,
      bounceRate: 0,
      exitRate: 0,
    }));
  }

  private processSourceData(data: GAReportResponse): GASourceData[] {
    return (data.rows || []).map(row => ({
      source: row.dimensionValues?.[0]?.value || '',
      medium: '',
      sessions: parseFloat(row.metricValues?.[0]?.value || '0'),
      users: parseFloat(row.metricValues?.[1]?.value || '0'),
      bounceRate: 0,
      conversions: 0,
    }));
  }

  private processCountryData(data: GAReportResponse): GACountryData[] {
    return (data.rows || []).map(row => ({
      country: row.dimensionValues?.[0]?.value || '',
      sessions: parseFloat(row.metricValues?.[0]?.value || '0'),
      users: parseFloat(row.metricValues?.[1]?.value || '0'),
      bounceRate: 0,
    }));
  }

  private processDeviceData(data: GAReportResponse): GADeviceData[] {
    return (data.rows || []).map(row => ({
      device: row.dimensionValues?.[0]?.value || '',
      sessions: parseFloat(row.metricValues?.[0]?.value || '0'),
      users: parseFloat(row.metricValues?.[1]?.value || '0'),
      bounceRate: 0,
    }));
  }

  private processBrowserData(data: GAReportResponse): GABrowserData[] {
    return (data.rows || []).map(row => ({
      browser: row.dimensionValues?.[0]?.value || '',
      sessions: parseFloat(row.metricValues?.[0]?.value || '0'),
      users: parseFloat(row.metricValues?.[1]?.value || '0'),
    }));
  }

  async getRealtimeData(propertyId: string): Promise<GARealtimeData> {
    interface RealtimeResponse {
      rows?: Array<{
        dimensionValues?: Array<{ value: string }>;
        metricValues?: Array<{ value: string }>;
      }>;
    }

    // Realtime API has different valid dimensions than regular API
    // sessionDefaultChannelGroup is not available in realtime
    const response = await this.makeApiRequest<RealtimeResponse>(
      `${GA_API_BASE}/properties/${propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
          dimensions: [{ name: 'unifiedScreenName' }, { name: 'countryId' }, { name: 'deviceCategory' }],
          limit: 100,
        }),
      }
    );

    const byPageMap = new Map<string, number>();
    const byCountryMap = new Map<string, number>();
    const byDeviceMap = new Map<string, number>();

    for (const row of response.rows || []) {
      const page = row.dimensionValues?.[0]?.value || '';
      const country = row.dimensionValues?.[1]?.value || '';
      const device = row.dimensionValues?.[2]?.value || '';
      const activeUsers = parseInt(row.metricValues?.[0]?.value || '0', 10);

      if (page) byPageMap.set(page, (byPageMap.get(page) || 0) + activeUsers);
      if (country) byCountryMap.set(country, (byCountryMap.get(country) || 0) + activeUsers);
      if (device) byDeviceMap.set(device, (byDeviceMap.get(device) || 0) + activeUsers);
    }

    const totalActiveUsers = Array.from(byPageMap.values()).reduce((sum, v) => sum + v, 0);

    return {
      activeUsers: totalActiveUsers,
      byPage: Array.from(byPageMap.entries()).map(([page, activeUsers]) => ({ page, activeUsers })).sort((a, b) => b.activeUsers - a.activeUsers).slice(0, 10),
      byCountry: Array.from(byCountryMap.entries()).map(([country, activeUsers]) => ({ country, activeUsers })).sort((a, b) => b.activeUsers - a.activeUsers).slice(0, 10),
      byDevice: Array.from(byDeviceMap.entries()).map(([device, activeUsers]) => ({ device, activeUsers })),
      bySource: [],
    };
  }
}
