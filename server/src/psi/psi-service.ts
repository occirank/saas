/**
 * PageSpeed Insights API Service
 * Handles communication with Google PageSpeed Insights API v5
 */

import type { PSIApiResponse, PSIAuditOptions, PSIConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';
const DEFAULT_TIMEOUT = 60000; // 60 seconds

export class PSIService {
  private apiKey?: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: PSIConfig = {}) {
    this.apiKey = config.apiKey || process.env.PSI_API_KEY;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Run a PageSpeed Insights audit for a single URL and strategy
   */
  async runAudit(options: PSIAuditOptions): Promise<PSIApiResponse> {
    const { url, categories = ['performance', 'accessibility', 'best-practices', 'seo'], strategy = 'mobile', locale = 'en-US' } = options;

    if (!url) {
      throw new Error('URL is required for PSI audit');
    }

    // Build query parameters - each category needs its own param
    const params = new URLSearchParams();
    params.set('url', url);
    params.set('strategy', strategy);
    params.set('locale', locale);
    for (const cat of categories) {
      params.append('category', cat);
    }

    // Add API key if available (higher rate limits with key)
    if (this.apiKey) {
      params.set('key', this.apiKey);
    }

    const requestUrl = `${this.baseUrl}?${params.toString()}`;

    console.log(`[PSI Service] Running ${strategy} audit for: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `PSI API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as PSIApiResponse;
      console.log(`[PSI Service] ${strategy} audit completed for: ${url}`);

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PSI audit timed out');
      }
      throw error;
    }
  }

  /**
   * Run PSI audit for both mobile and desktop strategies in parallel
   */
  async runFullAudit(
    url: string,
    categories: ('performance' | 'accessibility' | 'best-practices' | 'seo')[] = ['performance', 'accessibility', 'best-practices', 'seo']
  ): Promise<{ mobile: PSIApiResponse; desktop: PSIApiResponse }> {
    console.log(`[PSI Service] Starting full audit (mobile + desktop) for: ${url}`);

    // Run both strategies in parallel
    const [mobile, desktop] = await Promise.all([
      this.runAudit({ url, categories, strategy: 'mobile' }),
      this.runAudit({ url, categories, strategy: 'desktop' }),
    ]);

    console.log(`[PSI Service] Full audit completed for: ${url}`);

    return { mobile, desktop };
  }

  /**
   * Check if PSI API is accessible (no API key required, but recommended)
   */
  async checkAvailability(): Promise<{ available: boolean; hasApiKey: boolean; error?: string }> {
    const hasApiKey = !!this.apiKey;

    try {
      // Test with a simple request to a known URL
      await this.runAudit({
        url: 'https://example.com',
        categories: ['performance'],
        strategy: 'mobile',
      });

      return { available: true, hasApiKey };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { available: false, hasApiKey, error: message };
    }
  }
}

// Singleton instance
let psiServiceInstance: PSIService | null = null;

export function getPSIService(config?: PSIConfig): PSIService {
  if (!psiServiceInstance) {
    psiServiceInstance = new PSIService(config);
  }
  return psiServiceInstance;
}

export function resetPSIService(): void {
  psiServiceInstance = null;
}
