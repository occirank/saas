import { describe, it, expect } from 'vitest';
import { parseDeviceResult, parsePSIResult, getPSISummary } from '../psi-parser.js';
import type { PSIApiResponse } from '../types.js';

function createMockPSIApiResponse(overrides: Partial<PSIApiResponse> = {}): PSIApiResponse {
  return {
    kind: 'pagespeedonline#result',
    id: 'https://example.com',
    analysisUTCTimestamp: '2024-01-01T00:00:00.000Z',
    lighthouseResult: {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com',
      fetchTime: '2024-01-01T00:00:00.000Z',
      userAgent: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.0 Mobile Safari/537.36',
      categories: {
        'performance': { id: 'performance', title: 'Performance', score: 0.85, auditRefs: [] },
        'accessibility': { id: 'accessibility', title: 'Accessibility', score: 0.92, auditRefs: [] },
        'best-practices': { id: 'best-practices', title: 'Best Practices', score: 0.78, auditRefs: [] },
        'seo': { id: 'seo', title: 'SEO', score: 0.95, auditRefs: [] },
      },
      audits: {},
    },
    ...overrides,
  };
}

describe('parseDeviceResult', () => {
  it('should extract Lighthouse scores on 0-100 scale', () => {
    const response = createMockPSIApiResponse();
    const result = parseDeviceResult(response);

    expect(result.scores.performance).toBe(85);
    expect(result.scores.accessibility).toBe(92);
    expect(result.scores.bestPractices).toBe(78);
    expect(result.scores.seo).toBe(95);
  });

  it('should handle null scores as 0', () => {
    const response = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        categories: {
          'performance': { id: 'performance', title: 'Performance', score: null, auditRefs: [] },
          'accessibility': { id: 'accessibility', title: 'Accessibility', score: null, auditRefs: [] },
          'best-practices': { id: 'best-practices', title: 'Best Practices', score: null, auditRefs: [] },
          'seo': { id: 'seo', title: 'SEO', score: null, auditRefs: [] },
        },
      },
    });

    const result = parseDeviceResult(response);

    expect(result.scores.performance).toBe(0);
    expect(result.scores.accessibility).toBe(0);
  });

  it('should extract Core Web Vitals from CrUX data', () => {
    const response = createMockPSIApiResponse({
      loadingExperience: {
        id: 'https://example.com',
        overall_category: 'AVERAGE',
        metrics: {
          'LARGEST_CONTENTFUL_PAINT_MS': {
            category: 'FAST',
            percentile: 1200,
            distributions: [],
          },
          'INTERACTION_TO_NEXT_PAINT': {
            category: 'AVERAGE',
            percentile: 150,
            distributions: [],
          },
          'CUMULATIVE_LAYOUT_SHIFT_SCORE': {
            category: 'SLOW',
            percentile: 0.25,
            distributions: [],
          },
        },
      },
    });

    const result = parseDeviceResult(response);

    expect(result.coreWebVitals.lcp.value).toBe(1200);
    expect(result.coreWebVitals.lcp.score).toBe('good');
    expect(result.coreWebVitals.inp.score).toBe('needs-improvement');
    expect(result.coreWebVitals.cls.score).toBe('poor');
  });

  it('should return default Core Web Vitals when no CrUX data', () => {
    const response = createMockPSIApiResponse();
    const result = parseDeviceResult(response);

    expect(result.coreWebVitals.lcp.value).toBe(0);
    expect(result.coreWebVitals.lcp.score).toBe('poor');
    expect(result.coreWebVitals.inp.score).toBe('poor');
    expect(result.coreWebVitals.cls.score).toBe('poor');
  });

  it('should categorize audits correctly', () => {
    const response = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        audits: {
          'passed-audit': {
            id: 'passed-audit',
            title: 'Passed Audit',
            description: 'A passed audit',
            score: 1,
            scoreDisplayMode: 'binary',
          },
          'failed-audit-with-savings': {
            id: 'failed-audit-with-savings',
            title: 'Reduce unused JavaScript',
            description: 'Failed with savings',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: {
              type: 'table',
              overallSavingsMs: 500,
            },
          },
          'failed-diagnostic': {
            id: 'failed-diagnostic',
            title: 'Uses HTTPS',
            description: 'A diagnostic',
            score: 0,
            scoreDisplayMode: 'binary',
          },
          'informative-audit': {
            id: 'informative-audit',
            title: 'Informative',
            description: 'Should be skipped',
            score: null,
            scoreDisplayMode: 'informative',
          },
        },
      },
    });

    const result = parseDeviceResult(response);

    expect(result.passedAudits).toHaveLength(1);
    expect(result.passedAudits[0].id).toBe('passed-audit');
    expect(result.failedAudits).toHaveLength(2);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].id).toBe('failed-audit-with-savings');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].id).toBe('failed-diagnostic');
  });

  it('should sort opportunities by potential savings', () => {
    const response = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        audits: {
          'small-savings': {
            id: 'small-savings',
            title: 'Small Savings',
            description: 'Small',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: { type: 'table', overallSavingsMs: 100 },
          },
          'large-savings': {
            id: 'large-savings',
            title: 'Large Savings',
            description: 'Large',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: { type: 'table', overallSavingsMs: 1000 },
          },
          'medium-savings': {
            id: 'medium-savings',
            title: 'Medium Savings',
            description: 'Medium',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: { type: 'table', overallSavingsMs: 500 },
          },
        },
      },
    });

    const result = parseDeviceResult(response);

    expect(result.opportunities[0].id).toBe('large-savings');
    expect(result.opportunities[1].id).toBe('medium-savings');
    expect(result.opportunities[2].id).toBe('small-savings');
  });

  it('should extract finalUrl and fetchTime', () => {
    const response = createMockPSIApiResponse();
    const result = parseDeviceResult(response);

    expect(result.finalUrl).toBe('https://example.com');
    expect(result.fetchTime).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('parsePSIResult', () => {
  it('should combine mobile and desktop results', () => {
    const mobileResponse = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        categories: {
          ...createMockPSIApiResponse().lighthouseResult.categories,
          'performance': { id: 'performance', title: 'Performance', score: 0.80, auditRefs: [] },
        },
      },
    });

    const desktopResponse = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        categories: {
          ...createMockPSIApiResponse().lighthouseResult.categories,
          'performance': { id: 'performance', title: 'Performance', score: 0.90, auditRefs: [] },
        },
      },
    });

    const result = parsePSIResult('https://example.com', mobileResponse, desktopResponse);

    expect(result.url).toBe('https://example.com');
    expect(result.mobile.scores.performance).toBe(80);
    expect(result.desktop.scores.performance).toBe(90);
    expect(result.overallScore).toBe(85);
  });

  it('should set timestamp to current time', () => {
    const mobileResponse = createMockPSIApiResponse();
    const desktopResponse = createMockPSIApiResponse();

    const before = new Date().toISOString();
    const result = parsePSIResult('https://example.com', mobileResponse, desktopResponse);
    const after = new Date().toISOString();

    expect(result.timestamp >= before).toBe(true);
    expect(result.timestamp <= after).toBe(true);
  });
});

describe('getPSISummary', () => {
  function createMockPSIResult(cwvPassed: boolean) {
    const mobileResponse = createMockPSIApiResponse({
      loadingExperience: {
        id: 'https://example.com',
        overall_category: cwvPassed ? 'FAST' : 'SLOW',
        metrics: {
          'LARGEST_CONTENTFUL_PAINT_MS': {
            category: cwvPassed ? 'FAST' : 'SLOW',
            percentile: cwvPassed ? 1200 : 4000,
            distributions: [],
          },
          'INTERACTION_TO_NEXT_PAINT': {
            category: cwvPassed ? 'FAST' : 'SLOW',
            percentile: cwvPassed ? 100 : 400,
            distributions: [],
          },
          'CUMULATIVE_LAYOUT_SHIFT_SCORE': {
            category: cwvPassed ? 'FAST' : 'SLOW',
            percentile: cwvPassed ? 0.05 : 0.35,
            distributions: [],
          },
        },
      },
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        categories: {
          ...createMockPSIApiResponse().lighthouseResult.categories,
          'performance': { id: 'performance', title: 'Performance', score: 0.85, auditRefs: [] },
        },
        audits: {
          'opp-1': {
            id: 'opp-1',
            title: 'Reduce unused JavaScript',
            description: 'desc',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: { type: 'table', overallSavingsMs: 500 },
          },
          'opp-2': {
            id: 'opp-2',
            title: 'Eliminate render-blocking resources',
            description: 'desc',
            score: 0,
            scoreDisplayMode: 'numeric',
            details: { type: 'table', overallSavingsMs: 300 },
          },
        },
      },
    });

    const desktopResponse = createMockPSIApiResponse({
      lighthouseResult: {
        ...createMockPSIApiResponse().lighthouseResult,
        categories: {
          ...createMockPSIApiResponse().lighthouseResult.categories,
          'performance': { id: 'performance', title: 'Performance', score: 0.95, auditRefs: [] },
        },
      },
    });

    return parsePSIResult('https://example.com', mobileResponse, desktopResponse);
  }

  it('should return correct summary data', () => {
    const psiResult = createMockPSIResult(true);
    const summary = getPSISummary(psiResult);

    expect(summary.url).toBe('https://example.com');
    expect(summary.overallScore).toBe(90);
    expect(summary.mobilePerformance).toBe(85);
    expect(summary.desktopPerformance).toBe(95);
  });

  it('should detect Core Web Vitals as passed when all are good', () => {
    const psiResult = createMockPSIResult(true);
    const summary = getPSISummary(psiResult);

    expect(summary.coreWebVitalsPassed).toBe(true);
  });

  it('should detect Core Web Vitals as failed when any are poor', () => {
    const psiResult = createMockPSIResult(false);
    const summary = getPSISummary(psiResult);

    expect(summary.coreWebVitalsPassed).toBe(false);
  });

  it('should return top 5 opportunities', () => {
    const psiResult = createMockPSIResult(true);
    const summary = getPSISummary(psiResult);

    expect(summary.topOpportunities).toContain('Reduce unused JavaScript');
    expect(summary.topOpportunities).toContain('Eliminate render-blocking resources');
  });
});
