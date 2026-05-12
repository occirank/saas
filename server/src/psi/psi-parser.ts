import type {
  PSIApiResponse,
  PSIResult,
  DeviceResult,
  LighthouseScores,
  CoreWebVitals,
  LighthouseAuditItem,
  CruxMetric,
} from './types.js';

export function parseDeviceResult(response: PSIApiResponse): DeviceResult {
  const { lighthouseResult, loadingExperience } = response;
  const scores = extractLighthouseScores(lighthouseResult.categories);
  const coreWebVitals = extractCoreWebVitals(loadingExperience?.metrics);
  const allAudits = Object.values(lighthouseResult.audits);
  const { opportunities, diagnostics, passedAudits, failedAudits } = categorizeAudits(allAudits);

  return {
    scores,
    coreWebVitals,
    audits: allAudits,
    opportunities,
    diagnostics,
    passedAudits,
    failedAudits,
    lighthouseVersion: lighthouseResult.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown',
    fetchTime: lighthouseResult.fetchTime,
    finalUrl: lighthouseResult.finalUrl,
  };
}

export function parsePSIResult(
  url: string,
  mobile: PSIApiResponse,
  desktop: PSIApiResponse
): PSIResult {
  const mobileResult = parseDeviceResult(mobile);
  const desktopResult = parseDeviceResult(desktop);
  const overallScore = Math.round(
    (mobileResult.scores.performance + desktopResult.scores.performance) / 2
  );

  return {
    url,
    timestamp: new Date().toISOString(),
    mobile: mobileResult,
    desktop: desktopResult,
    overallScore,
  };
}

function extractLighthouseScores(categories: PSIApiResponse['lighthouseResult']['categories']): LighthouseScores {
  return {
    performance: normalizeScore(categories['performance']?.score),
    accessibility: normalizeScore(categories['accessibility']?.score),
    bestPractices: normalizeScore(categories['best-practices']?.score),
    seo: normalizeScore(categories['seo']?.score),
  };
}

function normalizeScore(score: number | null | undefined): number {
  if (score === null || score === undefined) return 0;
  return Math.round(score * 100);
}

type CruxMetrics = NonNullable<PSIApiResponse['loadingExperience']>['metrics'];

function extractCoreWebVitals(metrics: CruxMetrics | undefined): CoreWebVitals {
  const defaultMetric = {
    value: 0,
    unit: 'millisecond',
    score: 'poor' as const,
    percentile: 0,
  };

  if (!metrics) {
    return {
      lcp: defaultMetric,
      inp: defaultMetric,
      cls: { ...defaultMetric, unit: 'unitless' },
    };
  }

  return {
    lcp: parseCruxMetricMs(metrics['LARGEST_CONTENTFUL_PAINT_MS']),
    inp: parseCruxMetricMs(metrics['INTERACTION_TO_NEXT_PAINT']),
    cls: parseCruxMetricCLS(metrics['CUMULATIVE_LAYOUT_SHIFT_SCORE']),
    fcp: metrics['FIRST_CONTENTFUL_PAINT_MS']
      ? parseCruxMetricMs(metrics['FIRST_CONTENTFUL_PAINT_MS'])
      : undefined,
    ttfb: metrics['EXPERIMENTAL_TIME_TO_FIRST_BYTE']
      ? parseCruxMetricMs(metrics['EXPERIMENTAL_TIME_TO_FIRST_BYTE'])
      : undefined,
  };
}

function parseCruxMetricMs(
  metric: CruxMetric | undefined
): { value: number; unit: string; score: 'good' | 'needs-improvement' | 'poor'; percentile: number } {
  if (!metric) {
    return { value: 0, unit: 'millisecond', score: 'poor', percentile: 0 };
  }
  return {
    value: metric.percentile || 0,
    unit: 'millisecond',
    score: mapCruxCategoryToScore(metric.category),
    percentile: metric.percentile || 0,
  };
}

function parseCruxMetricCLS(
  metric: CruxMetric | undefined
): { value: number; unit: string; score: 'good' | 'needs-improvement' | 'poor'; percentile: number } {
  if (!metric) {
    return { value: 0, unit: 'unitless', score: 'poor', percentile: 0 };
  }
  // CLS is reported in hundredths (0-100 scale), convert to 0-1 scale
  const value = (metric.percentile || 0) / 100;
  return {
    value,
    unit: 'unitless',
    score: mapCruxCategoryToScore(metric.category),
    percentile: metric.percentile || 0,
  };
}



function mapCruxCategoryToScore(category: string): 'good' | 'needs-improvement' | 'poor' {
  switch (category.toLowerCase()) {
    case 'fast':
    case 'good':
      return 'good';
    case 'average':
    case 'moderate':
    case 'needs improvement':
      return 'needs-improvement';
    case 'slow':
    case 'poor':
    default:
      return 'poor';
  }
}

function categorizeAudits(audits: LighthouseAuditItem[]): {
  opportunities: LighthouseAuditItem[];
  diagnostics: LighthouseAuditItem[];
  passedAudits: LighthouseAuditItem[];
  failedAudits: LighthouseAuditItem[];
} {
  const opportunities: LighthouseAuditItem[] = [];
  const diagnostics: LighthouseAuditItem[] = [];
  const passedAudits: LighthouseAuditItem[] = [];
  const failedAudits: LighthouseAuditItem[] = [];

  for (const audit of audits) {
    if (
      audit.scoreDisplayMode === 'informative' ||
      audit.scoreDisplayMode === 'manual' ||
      audit.scoreDisplayMode === 'notApplicable'
    ) {
      continue;
    }

    const isPassed = audit.score === 1 || (audit.scoreDisplayMode === 'binary' && audit.score !== 0);

    if (isPassed) {
      passedAudits.push(audit);
    } else {
      failedAudits.push(audit);

      if (audit.details?.overallSavingsMs || audit.details?.overallSavingsBytes) {
        opportunities.push(audit);
      } else {
        diagnostics.push(audit);
      }
    }
  }

  opportunities.sort((a, b) => {
    const aSavings = a.details?.overallSavingsMs || 0;
    const bSavings = b.details?.overallSavingsMs || 0;
    return bSavings - aSavings;
  });

  return { opportunities, diagnostics, passedAudits, failedAudits };
}

export function getPSISummary(result: PSIResult): {
  url: string;
  overallScore: number;
  mobilePerformance: number;
  desktopPerformance: number;
  coreWebVitalsPassed: boolean;
  topOpportunities: string[];
} {
  const mobileCWW = result.mobile.coreWebVitals;
  const coreWebVitalsPassed =
    mobileCWW.lcp.score === 'good' &&
    mobileCWW.inp.score === 'good' &&
    mobileCWW.cls.score === 'good';

  const topOpportunities = result.mobile.opportunities
    .slice(0, 5)
    .map((audit) => audit.title);

  return {
    url: result.url,
    overallScore: result.overallScore,
    mobilePerformance: result.mobile.scores.performance,
    desktopPerformance: result.desktop.scores.performance,
    coreWebVitalsPassed,
    topOpportunities,
  };
}
