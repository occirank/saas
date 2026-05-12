import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PSIService, getPSIService, resetPSIService } from '../psi-service.js';

const mockApiResponse = {
  kind: 'pagespeedonline#result',
  id: 'https://example.com',
  analysisUTCTimestamp: '2024-01-01T00:00:00.000Z',
  lighthouseResult: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    fetchTime: '2024-01-01T00:00:00.000Z',
    userAgent: 'Chrome/120.0.6099.0',
    categories: {
      'performance': { id: 'performance', title: 'Performance', score: 0.85, auditRefs: [] },
      'accessibility': { id: 'accessibility', title: 'Accessibility', score: 0.92, auditRefs: [] },
      'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.78, auditRefs: [] },
      'seo': { id: 'seo', title: 'SEO', score: 0.95, auditRefs: [] },
    },
    audits: {},
  },
};

describe('PSIService', () => {
  let service: PSIService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new PSIService({ apiKey: 'test-api-key' });
    resetPSIService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('runAudit', () => {
    it('should construct correct API URL with all parameters', async () => {
      let capturedUrl = '';
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockApiResponse,
        } as Response;
      });

      await service.runAudit({
        url: 'https://example.com',
        categories: ['performance', 'accessibility'],
        strategy: 'mobile',
        locale: 'en-US',
      });

      expect(capturedUrl).toContain('url=https%3A%2F%2Fexample.com');
      expect(capturedUrl).toContain('category=performance');
      expect(capturedUrl).toContain('category=accessibility');
      expect(capturedUrl).toContain('strategy=mobile');
      expect(capturedUrl).toContain('locale=en-US');
      expect(capturedUrl).toContain('key=test-api-key');
    });

    it('should return parsed API response on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await service.runAudit({
        url: 'https://example.com',
      });

      expect(result.kind).toBe('pagespeedonline#result');
      expect(result.lighthouseResult.requestedUrl).toBe('https://example.com');
    });

    it('should throw error when URL is missing', async () => {
      await expect(service.runAudit({ url: '' })).rejects.toThrow('URL is required');
    });

    it('should throw error on API error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({
          error: { message: 'Invalid request' },
        }),
      } as Response);

      await expect(service.runAudit({ url: 'https://example.com' })).rejects.toThrow('Invalid request');
    });

    it('should throw error on non-JSON error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      await expect(service.runAudit({ url: 'https://example.com' })).rejects.toThrow('PSI API error: 500');
    });

    it('should throw timeout error when request times out', async () => {
      const quickService = new PSIService({ timeout: 10 });

      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 5);
        });
      });

      await expect(quickService.runAudit({ url: 'https://example.com' })).rejects.toThrow('timed out');
    });

    it('should work without API key', async () => {
      const noKeyService = new PSIService();
      let capturedUrl = '';

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockApiResponse,
        } as Response;
      });

      await noKeyService.runAudit({ url: 'https://example.com' });

      expect(capturedUrl).not.toContain('key=');
    });
  });

  describe('runFullAudit', () => {
    it('should run mobile and desktop audits in parallel', async () => {
      const capturedUrls: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrls.push(url);
        return {
          ok: true,
          json: async () => mockApiResponse,
        } as Response;
      });

      const result = await service.runFullAudit('https://example.com');

      expect(capturedUrls).toHaveLength(2);
      expect(capturedUrls[0]).toContain('strategy=mobile');
      expect(capturedUrls[1]).toContain('strategy=desktop');
      expect(result.mobile).toBeDefined();
      expect(result.desktop).toBeDefined();
    });

    it('should pass categories to both audits', async () => {
      const capturedUrls: string[] = [];

      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrls.push(url);
        return {
          ok: true,
          json: async () => mockApiResponse,
        } as Response;
      });

      await service.runFullAudit('https://example.com', ['performance']);

      expect(capturedUrls[0]).toContain('category=performance');
      expect(capturedUrls[1]).toContain('category=performance');
    });
  });

  describe('checkAvailability', () => {
    it('should return available true on successful test', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await service.checkAvailability();

      expect(result.available).toBe(true);
      expect(result.hasApiKey).toBe(true);
    });

    it('should return available false on failed test', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as Response);

      const result = await service.checkAvailability();

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should correctly report when no API key is configured', async () => {
      const noKeyService = new PSIService();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response);

      const result = await noKeyService.checkAvailability();

      expect(result.hasApiKey).toBe(false);
    });
  });
});

describe('getPSIService singleton', () => {
  beforeEach(() => {
    resetPSIService();
  });

  it('should return the same instance', () => {
    const instance1 = getPSIService();
    const instance2 = getPSIService();

    expect(instance1).toBe(instance2);
  });

  it('should create new instance after reset', () => {
    const instance1 = getPSIService();
    resetPSIService();
    const instance2 = getPSIService();

    expect(instance1).not.toBe(instance2);
  });

  it('should use provided config only on first call', () => {
    const instance1 = getPSIService({ apiKey: 'first-key' });
    const instance2 = getPSIService({ apiKey: 'second-key' });

    expect(instance1).toBe(instance2);
    expect(instance1['apiKey']).toBe('first-key');
  });
});
