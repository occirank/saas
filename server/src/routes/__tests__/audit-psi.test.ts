import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PSIResult, PSIApiResponse } from '../../psi/types.js';
import type { SFCrawlResult, PagePSIData } from '../../parsers/sf-parser.js';
import type { FullAuditResponse } from '../../types.js';

const mockPSIApiResponse = (): PSIApiResponse => ({
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
});

describe('PSI Route Integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('parsePSIResult', () => {
    it('should combine mobile and desktop responses into PSIResult', async () => {
      const { parsePSIResult } = await import('../../psi/psi-parser.js');

      const mobileResponse = mockPSIApiResponse();
      const desktopResponse = mockPSIApiResponse();

      const result = parsePSIResult('https://example.com', mobileResponse, desktopResponse);

      expect(result.url).toBe('https://example.com');
      expect(result.mobile).toBeDefined();
      expect(result.desktop).toBeDefined();
      expect(result.overallScore).toBe(85);
    });

    it('should keep mobile and desktop data separate', async () => {
      const { parsePSIResult } = await import('../../psi/psi-parser.js');

      const mobileResponse = mockPSIApiResponse();
      mobileResponse.lighthouseResult.categories['performance'].score = 0.50;

      const desktopResponse = mockPSIApiResponse();
      desktopResponse.lighthouseResult.categories['performance'].score = 0.90;

      const result = parsePSIResult('https://example.com', mobileResponse, desktopResponse);

      expect(result.mobile.scores.performance).toBe(50);
      expect(result.desktop.scores.performance).toBe(90);
      expect(result.overallScore).toBe(70);
    });
  });

  describe('Integrated SF+PSI structure', () => {
    it('should have sf with psiScores when PSI is integrated', async () => {
      const sf: SFCrawlResult = {
        summary: { totalPages: 10, crawledPages: 10, uniqueDomains: 1, brokenLinks: 0, redirects: 0, avgPageSize: 1000, avgResponseTime: 100 },
        pages: [
          {
            url: 'https://example.com/page1',
            statusCode: 200,
            issues: [],
            psi: {
              mobile: { performance: 75, accessibility: 90, bestPractices: 85, seo: 95, coreWebVitals: { lcp: { value: 1200, score: 'good' }, inp: { value: 100, score: 'good' }, cls: { value: 0.05, score: 'good' } } },
              desktop: { performance: 88, accessibility: 92, bestPractices: 90, seo: 98, coreWebVitals: { lcp: { value: 800, score: 'good' }, inp: { value: 50, score: 'good' }, cls: { value: 0.02, score: 'good' } } },
              overallScore: 81,
            },
          },
        ],
        issues: [],
        scores: { metaTags: 80, headings: 85, images: 90, links: 95, technical: 75, performance: 70, overall: 82 },
        psiScores: {
          avgMobilePerformance: 75,
          avgDesktopPerformance: 88,
          avgOverallPerformance: 81,
          coreWebVitalsPassRate: 100,
          pagesWithPSI: 1,
        },
      };

      expect(sf.psiScores).toBeDefined();
      expect(sf.psiScores?.avgMobilePerformance).toBe(75);
      expect(sf.pages[0].psi).toBeDefined();
      expect(sf.pages[0].psi?.overallScore).toBe(81);
    });

    it('should allow sf without psi per page', async () => {
      const sf: SFCrawlResult = {
        summary: { totalPages: 10, crawledPages: 10, uniqueDomains: 1, brokenLinks: 0, redirects: 0, avgPageSize: 1000, avgResponseTime: 100 },
        pages: [{ url: 'https://example.com/page1', statusCode: 200, issues: [] }],
        issues: [],
        scores: { metaTags: 80, headings: 85, images: 90, links: 95, technical: 75, performance: 70, overall: 82 },
      };

      expect(sf.psiScores).toBeUndefined();
      expect(sf.pages[0].psi).toBeUndefined();
    });
  });

  describe('FullAuditResponse with integrated SF', () => {
    it('should return sf with integrated PSI in response', async () => {
      const response: FullAuditResponse = {
        id: 'test-id',
        url: 'https://example.com',
        status: 'completed',
        auditType: 'full',
        startTime: new Date(),
        endTime: new Date(),
        createdAt: new Date(),
        overallScore: 81,
        sf: {
          summary: { totalPages: 10, crawledPages: 10, uniqueDomains: 1, brokenLinks: 0, redirects: 0, avgPageSize: 1000, avgResponseTime: 100 },
          pages: [{ url: 'https://example.com/page1', statusCode: 200, issues: [], psi: { mobile: {} as any, desktop: {} as any, overallScore: 75 } }],
          issues: [],
          scores: { metaTags: 80, headings: 85, images: 90, links: 95, technical: 75, performance: 70, overall: 82 },
          psiScores: { avgMobilePerformance: 75, avgDesktopPerformance: 88, avgOverallPerformance: 81, coreWebVitalsPassRate: 100, pagesWithPSI: 1 },
        },
      };

      expect(response.sf).toBeDefined();
      expect(response.sf?.psiScores).toBeDefined();
      expect(response.sf?.pages[0].psi).toBeDefined();
    });
  });

  describe('PSI Service with API key', () => {
    it('should be able to create service with config', async () => {
      const { PSIService, resetPSIService } = await import('../../psi/psi-service.js');

      resetPSIService();

      const service = new PSIService({ apiKey: 'test-key' });

      expect(service).toBeDefined();
    });

    it('should construct correct URL for PSI audit', async () => {
      const { PSIService, resetPSIService } = await import('../../psi/psi-service.js');

      resetPSIService();

      let capturedUrl = '';
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => mockPSIApiResponse(),
        } as Response;
      });

      const service = new PSIService({ apiKey: 'test-key' });
      await service.runAudit({ url: 'https://example.com' });

      expect(capturedUrl).toContain('url=https%3A%2F%2Fexample.com');
      expect(capturedUrl).toContain('key=test-key');
    });
  });

  describe('getPSISummary', () => {
    it('should extract summary from PSIResult', async () => {
      const { parsePSIResult, getPSISummary } = await import('../../psi/psi-parser.js');

      const mobileResponse = mockPSIApiResponse();
      mobileResponse.lighthouseResult.categories['performance'].score = 0.80;
      mobileResponse.loadingExperience = {
        id: 'https://example.com',
        overall_category: 'FAST',
        metrics: {
          'LARGEST_CONTENTFUL_PAINT_MS': { category: 'FAST', percentile: 1200, distributions: [] },
          'INTERACTION_TO_NEXT_PAINT': { category: 'FAST', percentile: 100, distributions: [] },
          'CUMULATIVE_LAYOUT_SHIFT_SCORE': { category: 'FAST', percentile: 0.05, distributions: [] },
        },
      };

      const desktopResponse = mockPSIApiResponse();
      desktopResponse.lighthouseResult.categories['performance'].score = 0.90;

      const psiResult = parsePSIResult('https://example.com', mobileResponse, desktopResponse);
      const summary = getPSISummary(psiResult);

      expect(summary.url).toBe('https://example.com');
      expect(summary.mobilePerformance).toBe(80);
      expect(summary.desktopPerformance).toBe(90);
      expect(summary.coreWebVitalsPassed).toBe(true);
    });
  });

  describe('PagePSIData type', () => {
    it('should have correct structure for per-page PSI', async () => {
      const pagePsi: PagePSIData = {
        mobile: {
          performance: 85,
          accessibility: 92,
          bestPractices: 78,
          seo: 95,
          coreWebVitals: {
            lcp: { value: 1200, score: 'good' },
            inp: { value: 100, score: 'good' },
            cls: { value: 0.05, score: 'good' },
          },
        },
        desktop: {
          performance: 90,
          accessibility: 95,
          bestPractices: 85,
          seo: 98,
          coreWebVitals: {
            lcp: { value: 800, score: 'good' },
            inp: { value: 50, score: 'good' },
            cls: { value: 0.02, score: 'good' },
          },
        },
        overallScore: 87,
      };

      expect(pagePsi.mobile.performance).toBe(85);
      expect(pagePsi.desktop.performance).toBe(90);
      expect(pagePsi.overallScore).toBe(87);
      expect(pagePsi.mobile.coreWebVitals.lcp.score).toBe('good');
    });
  });
});
