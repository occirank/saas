import { getPSIService } from './psi-service.js';
import { parseDeviceResult } from './psi-parser.js';
import type { PagePSIData, SFCrawlResult } from '../parsers/sf-parser.js';
export interface BatchPSIOptions {
  urls: string[];
  concurrency?: number;
  delayBetweenRequests?: number;
  onProgress?: (completed: number, total: number, currentUrl: string) => void;
}

export interface BatchPSIResult {
  results: Map<string, PagePSIData>;
  errors: Map<string, string>;
  completed: number;
  failed: number;
}

export async function runBatchPSI(options: BatchPSIOptions): Promise<BatchPSIResult> {
  const { urls, concurrency = 2, delayBetweenRequests = 1000, onProgress } = options;
  
  const results = new Map<string, PagePSIData>();
  const errors = new Map<string, string>();
  let completed = 0;
  let failed = 0;

  const psiService = getPSIService();

  const processUrl = async (url: string): Promise<void> => {
    try {
      onProgress?.(completed + failed, urls.length, url);
      
      const { mobile, desktop } = await psiService.runFullAudit(url);
      
      const mobileResult = parseDeviceResult(mobile);
      const desktopResult = parseDeviceResult(desktop);

      const pagePsi: PagePSIData = {
        mobile: {
          performance: mobileResult.scores.performance,
          accessibility: mobileResult.scores.accessibility,
          bestPractices: mobileResult.scores.bestPractices,
          seo: mobileResult.scores.seo,
          coreWebVitals: {
            lcp: { 
              value: mobileResult.coreWebVitals.lcp.value, 
              score: mobileResult.coreWebVitals.lcp.score 
            },
            inp: { 
              value: mobileResult.coreWebVitals.inp.value, 
              score: mobileResult.coreWebVitals.inp.score 
            },
            cls: { 
              value: mobileResult.coreWebVitals.cls.value, 
              score: mobileResult.coreWebVitals.cls.score 
            },
          },
        },
        desktop: {
          performance: desktopResult.scores.performance,
          accessibility: desktopResult.scores.accessibility,
          bestPractices: desktopResult.scores.bestPractices,
          seo: desktopResult.scores.seo,
          coreWebVitals: {
            lcp: { 
              value: desktopResult.coreWebVitals.lcp.value, 
              score: desktopResult.coreWebVitals.lcp.score 
            },
            inp: { 
              value: desktopResult.coreWebVitals.inp.value, 
              score: desktopResult.coreWebVitals.inp.score 
            },
            cls: { 
              value: desktopResult.coreWebVitals.cls.value, 
              score: desktopResult.coreWebVitals.cls.score 
            },
          },
        },
        overallScore: Math.round(
          (mobileResult.scores.performance + desktopResult.scores.performance) / 2
        ),
      };

      results.set(url, pagePsi);
      completed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PSI] Error for ${url}:`, message);
      if (error instanceof Error && error.stack) {
        console.error(error.stack.split('\n').slice(0, 3).join('\n'));
      }
      errors.set(url, message);
      failed++;
    }

    if (delayBetweenRequests > 0) {
      await sleep(delayBetweenRequests);
    }
  };

  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processUrl));
  }

  return { results, errors, completed, failed };
}

export function calculateAggregatePSIScores(
  pagesWithPsi: Array<{ psi?: PagePSIData }>
): SFCrawlResult['psiScores'] {
  const pagesWithPSIData = pagesWithPsi.filter(p => p.psi);
  
  if (pagesWithPSIData.length === 0) {
    return undefined;
  }

  const mobileScores = pagesWithPSIData.map(p => p.psi!.mobile.performance);
  const desktopScores = pagesWithPSIData.map(p => p.psi!.desktop.performance);
  
  const avgMobilePerformance = Math.round(
    mobileScores.reduce((a, b) => a + b, 0) / mobileScores.length
  );
  const avgDesktopPerformance = Math.round(
    desktopScores.reduce((a, b) => a + b, 0) / desktopScores.length
  );
  
  const cwvPassed = pagesWithPSIData.filter(p => {
    const cwv = p.psi!.mobile.coreWebVitals;
    return cwv.lcp.score === 'good' && cwv.inp.score === 'good' && cwv.cls.score === 'good';
  }).length;

  return {
    avgMobilePerformance,
    avgDesktopPerformance,
    avgOverallPerformance: Math.round((avgMobilePerformance + avgDesktopPerformance) / 2),
    coreWebVitalsPassRate: Math.round((cwvPassed / pagesWithPSIData.length) * 100),
    pagesWithPSI: pagesWithPSIData.length,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


