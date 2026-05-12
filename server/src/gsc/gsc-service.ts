  import type {
  GSCCredentials,
  GSCTokens,
  GSCSite,
  GSCSearchAnalyticsRequest,
  GSCSearchAnalyticsResponse,
  GSCAnalyticsResult,
  GSCSearchQuery,
  GSCPageData,
  GSCDailyData,
  GSCSummary,
  GSCSitemap,
  GSCIndexStatus,
  GSCBulkIndexStatus,
  GSCBulkIndexResult,
  GSCSitemapUrl,
  GSCCountryData,
  GSCDeviceData,
} from './types.js';
import fs from 'fs';
import path from 'path';

const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/indexing',
];

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';


// URL Inspection API has 2000 requests/day per property and 600/min
// No retry on 429 - it means daily quota exceeded, retrying won't help
const URL_INSPECTION_CONFIG = {
  batchDelay: 100,           // 100ms between batches (600/min = 10/sec, we're well under)
  concurrency: 5,           // 5 concurrent requests
};



const CACHE_DIR = path.join(process.cwd(), '.gsc-cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (same as quota reset)

interface CachedIndexResult {
  url: string;
  isIndexed: boolean;
  verdict: string;
  coverageState?: string;
  lastCrawlTime?: string;
  cachedAt: number;
}

function getCachePath(siteUrl: string): string {
  const safeName = siteUrl.replace(/[^a-z0-9]/gi, '_');
  return path.join(CACHE_DIR, `${safeName}.json`);
}

function loadCache(siteUrl: string): Map<string, CachedIndexResult> {
  const cachePath = getCachePath(siteUrl);
  const cache = new Map<string, CachedIndexResult>();
  
  try {
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const now = Date.now();
      
      for (const item of data) {
        // Only keep fresh cache entries
        if (now - item.cachedAt < CACHE_TTL_MS) {
          cache.set(item.url, item);
        }
      }
      console.log(`[GSC Cache] Loaded ${cache.size} cached results for ${siteUrl}`);
    }
  } catch (e) {
    console.warn('[GSC Cache] Failed to load cache:', e);
  }
  
  return cache;
}

function saveCache(siteUrl: string, cache: Map<string, CachedIndexResult>): void {
  const cachePath = getCachePath(siteUrl);
  
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(Array.from(cache.values()), null, 2));
    console.log(`[GSC Cache] Saved ${cache.size} results for ${siteUrl}`);
  } catch (e) {
    console.warn('[GSC Cache] Failed to save cache:', e);
  }
}

// Helper: Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Check if error is a quota exceeded error (not retryable)
function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('429') || 
           error.message.includes('RESOURCE_EXHAUSTED') ||
           error.message.includes('Quota exceeded');
  }
  return false;
}


let gscServiceInstance: GSCService | null = null;

export function getGSCService(): GSCService {
  if (!gscServiceInstance) {
    gscServiceInstance = new GSCService();
  }
  return gscServiceInstance;
}

export class GSCService {
  private credentials: GSCCredentials | null = null;
  private tokens: GSCTokens | null = null;

  constructor() {
    this.credentials = {
      clientId: process.env.GSC_CLIENT_ID || '',
      clientSecret: process.env.GSC_CLIENT_SECRET || '',
      redirectUri: process.env.GSC_REDIRECT_URI || 'http://localhost:3001/api/gsc/callback',
    };
  }

  setTokens(tokens: GSCTokens | null): void {
    this.tokens = tokens;
  }

  getTokens(): GSCTokens | null {
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
      throw new Error('GSC client ID not configured');
    }

    const params = new URLSearchParams({
      client_id: this.credentials.clientId,
      redirect_uri: this.credentials.redirectUri,
      response_type: 'code',
      scope: GSC_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GSCTokens> {
    if (!this.credentials) {
      throw new Error('GSC credentials not configured');
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

    const tokens: GSCTokens = {
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
      throw new Error('Not authenticated with Google Search Console');
    }

    // Refresh token if expired (5 minute buffer)
    if (this.tokens.expiryDate < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  private async makeApiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const accessToken = await this.ensureValidToken();

    const response = await fetch(`${GSC_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GSC API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getSites(): Promise<GSCSite[]> {
    interface SitesResponse {
      siteEntry?: Array<{
        siteUrl: string;
        permissionLevel: string;
      }>;
    }

    const data = await this.makeApiRequest<SitesResponse>('/sites');
    
    return (data.siteEntry || []).map(site => ({
      siteUrl: site.siteUrl,
      permissionLevel: site.permissionLevel as GSCSite['permissionLevel'],
    }));
  }

  async getSearchAnalytics(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: ('query' | 'page' | 'country' | 'device')[] = ['query'],
    rowLimit: number = 100
  ): Promise<GSCAnalyticsResult> {
    // Make separate API calls for queries, pages, countries, devices, daily and summary
    const [queryData, pageData, countryData, deviceData, dailyData, summaryData] = await Promise.all([
      // Get queries
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['query'],
            rowLimit,
            aggregationType: 'auto',
          }),
        }
      ),
      // Get pages
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['page'],
            rowLimit,
            aggregationType: 'auto',
          }),
        }
      ),
      // Get countries
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['country'],
            rowLimit,
            aggregationType: 'auto',
          }),
        }
      ),
      // Get devices
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['device'],
            rowLimit,
            aggregationType: 'auto',
          }),
        }
      ),
      // Get daily data
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['date'],
            rowLimit: 1000,
            aggregationType: 'auto',
          }),
        }
      ),
      // Get summary totals (no dimensions)
      this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: [],
            aggregationType: 'auto',
          }),
        }
      ),
    ]);

    // Process queries
    const queries: GSCSearchQuery[] = (queryData.rows || []).map(row => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // Process pages
    const pages: GSCPageData[] = (pageData.rows || []).map(row => ({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // Process countries
    const countries: GSCCountryData[] = (countryData.rows || []).map(row => ({
      country: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // Process devices
    const devices: GSCDeviceData[] = (deviceData.rows || []).map(row => ({
      device: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // Process daily data
    const daily: GSCDailyData[] = (dailyData.rows || [])
      .map(row => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get summary from the no-dimension call (this gives true totals)
    const summaryRow = summaryData.rows?.[0];
    const summary: GSCSummary = {
      totalClicks: summaryRow?.clicks || 0,
      totalImpressions: summaryRow?.impressions || 0,
      averageCtr: summaryRow?.ctr || 0,
      averagePosition: summaryRow?.position || 0,
      totalQueries: queries.length,
      totalPages: pages.length,
    };

    return {
      siteUrl,
      startDate,
      endDate,
      queries: queries.sort((a, b) => b.clicks - a.clicks),
      pages: pages.sort((a, b) => b.clicks - a.clicks),
      countries: countries.sort((a, b) => b.clicks - a.clicks),
      devices: devices.sort((a, b) => b.clicks - a.clicks),
      daily,
      summary,
    };
  }

  async getSitemaps(siteUrl: string): Promise<GSCSitemap[]> {
    interface SitemapsResponse {
      sitemap?: Array<{
        path: string;
        lastSubmitted?: string;
        lastDownloaded?: string;
        isPending: boolean;
        errors: number;
        warnings: number;
        contents?: Array<{
          type: string;
          submitted: number;
          indexed?: number;
        }>;
      }>;
    }

    const data = await this.makeApiRequest<SitemapsResponse>(
      `/sites/${encodeURIComponent(siteUrl)}/sitemaps`
    );

    return (data.sitemap || []).map(sitemap => ({
      path: sitemap.path,
      lastSubmitted: sitemap.lastSubmitted,
      lastDownloaded: sitemap.lastDownloaded,
      isPending: sitemap.isPending,
      errors: sitemap.errors,
      warnings: sitemap.warnings,
      contents: (sitemap.contents || []).map(c => ({
        type: c.type as GSCSitemap['contents'][0]['type'],
        submitted: c.submitted,
        indexed: c.indexed,
      })),
    }));
  }

  async submitSitemap(siteUrl: string, sitemapPath: string): Promise<void> {
    await this.makeApiRequest(
      `/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapPath)}`,
      { method: 'PUT' }
    );
  }

  async deleteSitemap(siteUrl: string, sitemapPath: string): Promise<void> {
    await this.makeApiRequest(
      `/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapPath)}`,
      { method: 'DELETE' }
    );
  }

  async getSitemapUrls(sitemapUrl: string): Promise<GSCSitemapUrl[]> {
    try {
      const response = await fetch(sitemapUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status}`);
      }
      const xml = await response.text();
      
      // Parse XML to extract URLs
      const urls: GSCSitemapUrl[] = [];
      
      // Match <url> elements
      const urlMatches = xml.match(/<url[^>]*>[\s\S]*?<\/url>/gi) || [];
      
      for (const urlBlock of urlMatches) {
        const locMatch = urlBlock.match(/<loc>([\s\S]*?)<\/loc>/i);
        const lastmodMatch = urlBlock.match(/<lastmod>([\s\S]*?)<\/lastmod>/i);
        const changefreqMatch = urlBlock.match(/<changefreq>([\s\S]*?)<\/changefreq>/i);
        const priorityMatch = urlBlock.match(/<priority>([\s\S]*?)<\/priority>/i);
        
        if (locMatch) {
          urls.push({
            loc: locMatch[1].trim(),
            lastmod: lastmodMatch?.[1]?.trim(),
            changefreq: changefreqMatch?.[1]?.trim(),
            priority: priorityMatch?.[1]?.trim(),
          });
        }
      }
      
      // Also check for sitemap index (nested sitemaps)
      const sitemapMatches = xml.match(/<sitemap[^>]*>[\s\S]*?<\/sitemap>/gi) || [];
      for (const sitemapBlock of sitemapMatches) {
        const locMatch = sitemapBlock.match(/<loc>([\s\S]*?)<\/loc>/i);
        if (locMatch) {
          // Recursively fetch nested sitemaps
          const nestedUrls = await this.getSitemapUrls(locMatch[1].trim());
          urls.push(...nestedUrls);
        }
      }
      
      return urls;
    } catch (error) {
      console.error(`Failed to parse sitemap ${sitemapUrl}:`, error);
      return [];
    }
  }

  async getUrlIndexingStatus(url: string, siteUrl?: string): Promise<GSCIndexStatus> {
    // Note: This uses the URL Inspection API (different from GSC API)
    // Requires additional scope: https://www.googleapis.com/auth/indexing
    const accessToken = await this.ensureValidToken();

    interface InspectionResponse {
      inspectionResult?: {
        indexStatusResult?: {
          verdict: string;
          coverageState?: string;
          robotsTxtState?: string;
          sitemapState?: string;
          lastCrawlTime?: string;
          indexingState?: string;
          pageFetchState?: string;
        };
      };
    }

    // Use provided siteUrl or derive from URL
    const propertyUrl = siteUrl || new URL(url).origin;

    const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inspectionUrl: url,
        siteUrl: propertyUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`URL Inspection API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as InspectionResponse;
    console.log('[URLInspection] Full response for', url, ':', JSON.stringify(data, null, 2));
    const indexStatus = data.inspectionResult?.indexStatusResult;

    return {
      url,
      verdict: (indexStatus?.verdict || 'NEUTRAL') as GSCIndexStatus['verdict'],
      coverageState: indexStatus?.coverageState,
      robotsTxtState: indexStatus?.robotsTxtState,
      sitemapState: indexStatus?.sitemapState,
      lastCrawlTime: indexStatus?.lastCrawlTime,
      indexingState: indexStatus?.indexingState,
      pageFetchState: indexStatus?.pageFetchState,
    };
  }

  async getBulkUrlIndexingStatus(
    urls: string[],
    siteUrl: string,
    concurrency: number = URL_INSPECTION_CONFIG.concurrency
  ): Promise<GSCBulkIndexResult> {
    const results: GSCBulkIndexStatus[] = [];
    const verdictCounts: Record<string, number> = {};
    let quotaExceeded = false;

    // Load cached results
    const cache = loadCache(siteUrl);
    const urlsToCheck: string[] = [];
    const cachedResults: GSCBulkIndexStatus[] = [];

    // Separate cached and uncached URLs
    for (const url of urls) {
      const cached = cache.get(url);
      if (cached) {
        cachedResults.push({
          url: cached.url,
          isIndexed: cached.isIndexed,
          verdict: cached.verdict as GSCBulkIndexStatus['verdict'],
          coverageState: cached.coverageState,
          lastCrawlTime: cached.lastCrawlTime,
        });
        verdictCounts[cached.verdict] = (verdictCounts[cached.verdict] || 0) + 1;
      } else {
        urlsToCheck.push(url);
      }
    }

    console.log(`[GSC] ${cachedResults.length} cached, ${urlsToCheck.length} to check`);
    results.push(...cachedResults);

    // Process uncached URLs in batches
    for (let i = 0; i < urlsToCheck.length && !quotaExceeded; i += concurrency) {
      const batch = urlsToCheck.slice(i, i + concurrency);

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            const status = await this.getUrlIndexingStatus(url, siteUrl);
            verdictCounts[status.verdict] = (verdictCounts[status.verdict] || 0) + 1;

            const isIndexed = status.verdict === 'PASS' || status.verdict === 'VERIFIED';

            // Cache the result
            cache.set(url, {
              url,
              isIndexed,
              verdict: status.verdict,
              coverageState: status.coverageState,
              lastCrawlTime: status.lastCrawlTime,
              cachedAt: Date.now(),
            });

            return {
              url,
              isIndexed,
              verdict: status.verdict,
              coverageState: status.coverageState,
              lastCrawlTime: status.lastCrawlTime,
            } as GSCBulkIndexStatus;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[GSC] URL Inspection ERROR for ${url}:`, errorMsg);
            verdictCounts['ERROR'] = (verdictCounts['ERROR'] || 0) + 1;

            const isQuotaError = isQuotaExceededError(error);
            if (isQuotaError) {
              quotaExceeded = true;
            }

            return {
              url,
              isIndexed: false,
              verdict: 'ERROR' as const,
              error: errorMsg,
              isRateLimited: isQuotaError,
            } as GSCBulkIndexStatus;
          }
        })
      );

      results.push(...batchResults);

      // Log progress every 50 URLs
      if (results.length % 50 === 0) {
        console.log(`Progress: ${results.length}/${urls.length} URLs checked. Verdicts:`, verdictCounts);
      }

      // Stop if daily quota exceeded - no point continuing
      if (quotaExceeded) {
        console.warn(`[GSC] Daily quota exceeded - stopping early. Checked ${results.length}/${urls.length} URLs`);
        break;
      }

      // Small delay between batches
      if (i + concurrency < urlsToCheck.length) {
        await sleep(URL_INSPECTION_CONFIG.batchDelay);
      }
    }

    // Save cache (includes both old and new results)
    saveCache(siteUrl, cache);

    console.log('Final verdict counts:', verdictCounts);

    return {
      siteUrl,
      results,
      summary: {
        total: results.length,
        indexed: results.filter(r => r.isIndexed).length,
        notIndexed: results.filter(r => !r.isIndexed && !r.error).length,
        errors: results.filter(r => !!r.error).length,
      },
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Fast index coverage using URL Inspection API for accurate results
   * Only checks sitemap URLs (most accurate)
   */
  async getAccurateIndexCoverage(
    siteUrl: string
  ): Promise<GSCBulkIndexResult> {
    console.log(`[AccurateIndexCoverage] Starting for ${siteUrl}`);
    
    // 1. Get all sitemaps
    const sitemaps = await this.getSitemaps(siteUrl);
    console.log(`[AccurateIndexCoverage] Found ${sitemaps.length} sitemaps`);
    
    // 2. Parse all sitemaps to get all submitted URLs
    const allSubmittedUrls = new Set<string>();
    for (const sitemap of sitemaps) {
      try {
        const urls = await this.getSitemapUrls(sitemap.path);
        console.log(`[AccurateIndexCoverage] Sitemap ${sitemap.path}: ${urls.length} URLs`);
        urls.forEach(u => allSubmittedUrls.add(u.loc));
      } catch (e) {
        console.error(`[AccurateIndexCoverage] Failed to parse sitemap ${sitemap.path}:`, e);
      }
    }
    
    const urlsArray = Array.from(allSubmittedUrls);
    console.log(`[AccurateIndexCoverage] Total URLs to check: ${urlsArray.length}`);
    
    // 3. Use URL Inspection for accurate status
    return this.getBulkUrlIndexingStatus(urlsArray, siteUrl, 25);
  }

  async getFullIndexCoverage(
    siteUrl: string,
    startDate?: string,
    endDate?: string
  ): Promise<GSCBulkIndexResult> {
    // 1. Get all sitemaps
    const sitemaps = await this.getSitemaps(siteUrl);
    console.log(`[IndexCoverage] Found ${sitemaps.length} sitemaps`);
    
    // 2. Parse all sitemaps to get all submitted URLs
    const allSubmittedUrls = new Set<string>();
    for (const sitemap of sitemaps) {
      try {
        const urls = await this.getSitemapUrls(sitemap.path);
        console.log(`[IndexCoverage] Sitemap ${sitemap.path}: ${urls.length} URLs`);
        urls.forEach(u => allSubmittedUrls.add(u.loc));
      } catch (e) {
        console.error(`[IndexCoverage] Failed to parse sitemap ${sitemap.path}:`, e);
      }
    }
    console.log(`[IndexCoverage] Total URLs from sitemaps: ${allSubmittedUrls.size}`);
    
    // 3. Get ALL analytics data with pagination
    // Use 16 months range (GSC max) to get all possible pages
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 480 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const allAnalyticsPages: Map<string, { clicks: number; impressions: number; position: number; ctr: number }> = new Map();
    let startRow = 0;
    const rowLimit = 25000;
    let hasMore = true;
    
    while (hasMore) {
      console.log(`[IndexCoverage] Fetching analytics rows ${startRow} to ${startRow + rowLimit}`);
      
      const response = await this.makeApiRequest<GSCSearchAnalyticsResponse>(
        `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            startDate: start,
            endDate: end,
            dimensions: ['page'],
            rowLimit,
            startRow,
            aggregationType: 'auto',
          }),
        }
      );
      
      const rows = response.rows || [];
      console.log(`[IndexCoverage] Got ${rows.length} rows`);
      
      for (const row of rows) {
        const page = row.keys[0];
        allAnalyticsPages.set(page, {
          clicks: row.clicks,
          impressions: row.impressions,
          position: row.position,
          ctr: row.ctr,
        });
      }
      
      // If we got less than rowLimit, we've reached the end
      if (rows.length < rowLimit) {
        hasMore = false;
      } else {
        startRow += rowLimit;
      }
      
      // Safety limit - don't fetch more than 100k rows
      if (startRow >= 100000) {
        console.log('[IndexCoverage] Reached safety limit of 100k rows');
        break;
      }
    }
    
    console.log(`[IndexCoverage] Total pages from analytics: ${allAnalyticsPages.size}`);
    
    // Pages appearing in analytics = indexed (Google shows them in search)
    const indexedPageUrls = new Set(allAnalyticsPages.keys());
    
    // 4. Build results
    const results: GSCBulkIndexStatus[] = [];
    
    // Add all submitted URLs from sitemaps
    for (const url of allSubmittedUrls) {
      const analyticsData = allAnalyticsPages.get(url);
      const isIndexed = indexedPageUrls.has(url);
      
      results.push({
        url,
        isIndexed,
        verdict: isIndexed ? 'VERIFIED' : 'NEUTRAL',
        coverageState: isIndexed 
          ? `Indexed - ${analyticsData?.impressions || 0} impressions, ${analyticsData?.clicks || 0} clicks`
          : 'Not indexed - submitted in sitemap but not found in search results',
        clicks: analyticsData?.clicks || 0,
        impressions: analyticsData?.impressions || 0,
        position: analyticsData?.position || 0,
      });
    }
    
    // Add URLs from analytics that weren't in sitemap (discovered by Google)
    for (const [url, data] of allAnalyticsPages) {
      if (!allSubmittedUrls.has(url)) {
        results.push({
          url,
          isIndexed: true,
          verdict: 'VERIFIED',
          coverageState: 'Indexed - discovered by Google (not in sitemap)',
          clicks: data.clicks,
          impressions: data.impressions,
          position: data.position,
        });
      }
    }
    
    const indexedCount = results.filter(r => r.isIndexed).length;
    console.log(`[IndexCoverage] Final results: ${indexedCount} indexed, ${results.length - indexedCount} not indexed, ${results.length} total`);

    return {
      siteUrl,
      results,
      summary: {
        total: results.length,
        indexed: indexedCount,
        notIndexed: results.length - indexedCount,
        errors: 0,
      },
      fetchedAt: new Date().toISOString(),
    };
  }
  /**
   * Extract GSC issues for audit checklist
   * Returns array of issue types detected from GSC data
   * Covers all 16 GSC questions
   */
  async extractGSCIssues(siteUrl: string): Promise<string[]> {
    const issues: string[] = [];
    
    try {
      // ========================================
      // 1. CHECK IF SITE IS VERIFIED IN GSC
      // ========================================
      const sites = await this.getSites();
      const site = sites.find(s => 
        s.siteUrl === siteUrl || 
        s.siteUrl === `sc-domain:${new URL(siteUrl).hostname}` ||
        s.siteUrl === `https://${new URL(siteUrl).hostname}` ||
        s.siteUrl === `http://${new URL(siteUrl).hostname}`
      );
      
      // Q13: Est-ce que le site est configuré dans Google Search Console?
      if (!site) {
        issues.push('GSC not verified');
        issues.push('GSC property not set');
        return issues;
      }
      
      if (site.permissionLevel === 'siteUnverifiedUser') {
        issues.push('GSC not verified');
      }
      
      // Q10: Est-ce qu'une propriété GSC par site (donc par pays) a bien été créée?
      // Check if we have the specific property (not just domain property)
      const hasExactProperty = sites.some(s => 
        s.siteUrl === siteUrl || 
        s.siteUrl === `https://${new URL(siteUrl).hostname}`
      );
      if (!hasExactProperty) {
        issues.push('GSC property not set');
      }
      
      // ========================================
      // 2. CHECK SITEMAPS
      // ========================================
      const sitemaps = await this.getSitemaps(siteUrl);
      
      // Q7: Est-ce que la/les sitemap(s) sont listées dans la Google Search Console?
      if (sitemaps.length === 0) {
        issues.push('Sitemaps not listed');
        issues.push('No sitemaps submitted');
      }
      
      // Q8: Est-ce que la/les sitemap(s) possèdent des "Erreurs" ou "avertissements"?
      const sitemapsWithErrors = sitemaps.filter(s => s.errors > 0);
      const sitemapsWithWarnings = sitemaps.filter(s => s.warnings > 0);
      
      if (sitemapsWithErrors.length > 0) {
        issues.push('Sitemap errors');
      }
      if (sitemapsWithWarnings.length > 0) {
        issues.push('Sitemap warnings');
      }
      
      // ========================================
      // 3. CHECK INDEXING STATUS (URL INSPECTION API)
      // ========================================
      const indexResults = await this.getAccurateIndexCoverage(siteUrl);
      const totalUrls = indexResults.results.length;
      const indexedUrls = indexResults.results.filter(r => r.isIndexed);
      const notIndexedUrls = indexResults.results.filter(r => !r.isIndexed && !r.error);
      const errorUrls = indexResults.results.filter(r => r.error);
      
      // Q9: Y'a t'il des problèmes d'indexation pour ce(s) sous-domaine(s)?
      if (notIndexedUrls.length > totalUrls * 0.1) {
        issues.push('Indexing issues');
        issues.push('Coverage issues');
      }
      
      // Q1: Est-ce que l'état de l'indexation montre des anomalies?
      // Anomaly: high percentage of URLs with errors or unusual coverage states
      if (errorUrls.length > totalUrls * 0.05 || notIndexedUrls.length > totalUrls * 0.2) {
        issues.push('Indexing anomalies');
        issues.push('Coverage state anomaly');
      }
      
      // Q3: Est-ce que le site possède des pages bloquées non intentionnellement par robots.txt?
      const blockedByRobots = indexResults.results.filter(r => 
        r.coverageState?.toLowerCase().includes('robots.txt') ||
        r.coverageState?.toLowerCase().includes('blocked by')
      );
      if (blockedByRobots.length > 0) {
        issues.push('Blocked by robots.txt');
      }
      
      // Q4: Est-ce que le site possède des ressources non intentionnellement bloquées par robots.txt?
      // Check for JS/CSS resources blocked (indicated by pageFetchState issues)
      const resourceBlocked = indexResults.results.filter(r => 
        r.coverageState?.toLowerCase().includes('resource') ||
        r.pageFetchState?.toLowerCase().includes('blocked')
      );
      if (resourceBlocked.length > 0 || blockedByRobots.length > 0) {
        issues.push('Resources blocked by robots.txt');
      }
      
      // Q2: Est-ce que le fichier robots.txt possède des "Erreurs" ou "Avertissements"?
      // Check if robots.txt is blocking important pages
      if (blockedByRobots.length > totalUrls * 0.05) {
        issues.push('Robots.txt errors');
      }
      if (blockedByRobots.length > 0 && blockedByRobots.length <= totalUrls * 0.05) {
        issues.push('Robots.txt warnings');
      }
      
      // Q6: Est-ce que le site rencontre des anomalies au niveau statistiques de crawl par GoogleBot?
      const crawlAnomalies = indexResults.results.filter(r => 
        !r.isIndexed && 
        !r.error &&
        !r.coverageState?.toLowerCase().includes('robots.txt') &&
        !r.coverageState?.toLowerCase().includes('redirect') &&
        !r.coverageState?.toLowerCase().includes('canonical')
      );
      if (crawlAnomalies.length > 10) {
        issues.push('Crawl anomalies');
      }
      
      // ========================================
      // 4. CHECK SEARCH ANALYTICS
      // ========================================
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const analytics = await this.getSearchAnalytics(siteUrl, startDate, endDate, ['page'], 1000);
      
      // Q5: Le site rencontre t'il des erreurs d'exploration (Crawl)?
      // Pages with impressions but very low CTR might indicate crawl issues
      const lowCtrPages = analytics.pages.filter(p => p.impressions > 100 && p.ctr < 0.01);
      if (lowCtrPages.length > analytics.pages.length * 0.2) {
        issues.push('Crawl errors');
      }
      
      // ========================================
      // 5. CHECK HREFLANG ERRORS
      // ========================================
      // Q12: Est-ce que Google Search Console a détecté des erreurs relatives à la balise Hreflang?
      // Check for hreflang issues in coverage state
      const hreflangIssues = indexResults.results.filter(r => 
        r.coverageState?.toLowerCase().includes('hreflang') ||
        r.coverageState?.toLowerCase().includes('alternate')
      );
      if (hreflangIssues.length > 0) {
        issues.push('Hreflang errors');
      }
      
      // ========================================
      // 6. CHECK TARGET COUNTRY (via International Targeting API)
      // Q11: Est-ce qu'un pays cible est défini dans Google Search Console pour chaque site?
      // Note: This requires additional API call to International Targeting
      // For now, we assume it's set if the site has analytics data
      // Full implementation would need: webmasters/v3/sites/{siteUrl}/urlCrawlErrorsCounts
      // ========================================
      
      // ========================================
      // 7. CHECK FOR MANUAL ACTIONS & SECURITY ISSUES
      // ========================================
      
      // Q14: Est-ce que le site a reçu une pénalité de type "Action manuelle"?
      // Manual actions are visible in GSC UI but not directly exposed via API
      // We can try to infer from severe indexing drops
      const severeIndexingDrop = notIndexedUrls.length > totalUrls * 0.5 && indexedUrls.length < totalUrls * 0.3;
      if (severeIndexingDrop) {
        issues.push('Manual action penalty');
      }
      
      // Q11: Est-ce qu'un pays cible est défini dans Google Search Console?
      // Check if site has international targeting configured via analytics data
      // Q11: Est-ce qu'un pays cible est défini dans Google Search Console?
      // Check if site has international targeting configured via analytics data
      // Now uses the countries field from the updated getSearchAnalytics
      const hasMultipleCountries = analytics.countries && analytics.countries.length > 3;
      
      // Target country is assumed to be set if GSC is properly configured
      // We can't directly check this via API, so we assume it's OK if site is verified
      // For multi-country sites without clear targeting, flag it
      if (hasMultipleCountries && !process.env.SKIP_COUNTRY_TARGETING_CHECK) {
        issues.push('Target country not set');
      }
      // Q15: Est-ce que le site a des suggestions d'améliorations?
      // Check PSI scores for improvement opportunities
      const psiApiKey = process.env.PSI_API_KEY;
      if (psiApiKey) {
        try {
          const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(siteUrl)}&key=${psiApiKey}&category=performance,accessibility,best-practices,seo`;
          const psiResponse = await fetch(psiUrl);
          if (psiResponse.ok) {
            const psiData = await psiResponse.json() as {
              lighthouseResult?: {
                categories?: {
                  performance?: { score?: number };
                  accessibility?: { score?: number };
                  ['best-practices']?: { score?: number };
                  seo?: { score?: number };
                };
              };
            };
            const categories = psiData.lighthouseResult?.categories;
            // If any score is below 0.9, there are improvement opportunities
            const hasLowScores = 
              (categories?.performance?.score || 0) < 0.9 ||
              (categories?.accessibility?.score || 0) < 0.9 ||
              (categories?.['best-practices']?.score || 0) < 0.9 ||
              (categories?.seo?.score || 0) < 0.9;
            if (hasLowScores) {
              issues.push('Improvement suggestions');
            }
          }
        } catch (psiError) {
          console.log('[GSC Issues] PSI check failed:', psiError);
        }
      }
      
      // Q16: Le site possède t'il des problèmes de sécurité?
      // Check Safe Browsing API for security issues
      const safeBrowsingApiKey = process.env.SAFE_BROWSING_API_KEY;
      if (safeBrowsingApiKey) {
        try {
          const safeBrowsingUrl = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
          const safeBrowsingBody = {
            client: {
              clientId: 'occirank',
              clientVersion: '1.0.0'
            },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [{ url: siteUrl }]
            }
          };
          const sbResponse = await fetch(`${safeBrowsingUrl}?key=${safeBrowsingApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safeBrowsingBody)
          });
          if (sbResponse.ok) {
            const sbData = await sbResponse.json() as { matches?: unknown[] };
            if (sbData.matches && sbData.matches.length > 0) {
              issues.push('Security issues');
            }
          }
        } catch (sbError) {
          console.log('[GSC Issues] Safe Browsing check failed:', sbError);
        }
      }
      
      console.log(`[GSC Issues] Found ${issues.length} issue types for ${siteUrl}`);
      console.log(`[GSC Issues] Issue types:`, issues);
      return issues;
      
    } catch (error) {
      console.error(`[GSC Issues] Error extracting issues for ${siteUrl}:`, error);
      // Return minimal issues on error
      issues.push('GSC not verified');
      return issues;
    }
  }
}
