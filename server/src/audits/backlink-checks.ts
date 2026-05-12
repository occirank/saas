import type { BacklinkCheckResult, BacklinkAnalysisResult, RefdomainsHistoryPoint } from '../ahrefs/types.js';
import { getAhrefsProxyService } from '../ahrefs/index.js';
import {
  analyzeRefdomainsTrend,
  checkRapidGain,
  checkRapidDrop,
  checkSpikeDropPattern,
  checkPositiveTrend,
  estimateAnchorOveruse,
  estimateTldMismatch,
  checkBrokenBacklinks,
  checkLowQualityRefdomains,
  estimateSponsoredLinksWithoutNofollow,
  estimateDirectoryLinks,
} from './backlink-estimator.js';

export interface BacklinkCheckInput {
  domain: string;
  country?: string;
  sfBrokenLinks?: { url: string; statusCode: number }[];
  sfBacklinks?: { anchor?: string; pageTitle?: string; urlFrom?: string }[];
  sfRefdomains?: { domain: string; domainRating?: number; isSpam?: boolean }[];
}

export async function runBacklinkChecks(input: BacklinkCheckInput): Promise<BacklinkCheckResult[]> {
  const ahrefsService = getAhrefsProxyService();
  const results: BacklinkCheckResult[] = [];

  let ahrefsData: BacklinkAnalysisResult | null = null;
  
  if (ahrefsService.isConfigured()) {
    try {
      ahrefsData = await ahrefsService.getFullAnalysis(input.domain, input.country);
    } catch (error) {
      console.error('[Backlink Checks] Ahrefs proxy error:', error);
    }
  }

  if (ahrefsData && ahrefsData.refdomainsHistory.length > 0) {
    const trend = analyzeRefdomainsTrend(ahrefsData.refdomainsHistory);
    
    results.push(checkRapidGain(trend));
    results.push(checkRapidDrop(trend));
    results.push(checkSpikeDropPattern(trend));
    results.push(checkPositiveTrend(trend));
  } else {
    results.push(createUnknownResult('Q55', 'Y a t-il un gain rapide en termes de domaines référents?'));
    results.push(createUnknownResult('Q56', 'Y a t-il une chute en termes de domaines référents?'));
    results.push(createUnknownResult('Q57', 'Y a t-il un pic (gain rapide suivi d\'une chute) en termes de domaines référents?'));
    results.push(createUnknownResult('Q58', 'Est-ce que la courbe d\'évolution des domaines référents est positive?'));
  }

  results.push(estimateAnchorOveruse([]));

  if (input.sfRefdomains && input.sfRefdomains.length > 0) {
    results.push(estimateTldMismatch(input.sfRefdomains, input.country || 'fr'));
    results.push(checkLowQualityRefdomains(input.sfRefdomains));
  } else {
    results.push(createUnknownResult('Q60', 'Est-ce que plus de 25% des domaines référents ont une extension (TLD) ne correspondant pas au pays principal ciblé?'));
    results.push(createUnknownResult('Q62', 'Y a t-il des domaines référents de mauvaise qualité?'));
  }

  if (input.sfBrokenLinks && input.sfBrokenLinks.length >= 0) {
    results.push(checkBrokenBacklinks(input.sfBrokenLinks));
  } else {
    results.push(createUnknownResult('Q61', 'Y a t-il des backlinks pointant vers des pages retournant un code erreur 404?'));
  }

  if (input.sfBacklinks && input.sfBacklinks.length > 0) {
    results.push(estimateSponsoredLinksWithoutNofollow(input.sfBacklinks));
    results.push(estimateDirectoryLinks(input.sfBacklinks));
  } else {
    results.push(createUnknownResult('Q63', 'Est-ce que certains backlinks sont achetés/sponsorisés sans directive "nofollow"?'));
    results.push(createUnknownResult('Q64', 'Y a t-il des backlinks provenant d\'annuaires généralistes?'));
  }

  return results;
}

function createUnknownResult(questionId: string, question: string): BacklinkCheckResult {
  return {
    questionId,
    question,
    answer: 'unknown',
    status: 'info',
    score: 50,
    details: 'Insufficient data to answer this question',
    recommendation: 'Connect Ahrefs proxy or provide SF crawler backlink data for accurate analysis',
  };
}

export function extractSFBrokenLinks(pages: any[]): { url: string; statusCode: number }[] {
  const brokenLinks: { url: string; statusCode: number }[] = [];
  
  for (const page of pages) {
    if (page.statusCode && page.statusCode !== 200) {
      brokenLinks.push({
        url: page.url,
        statusCode: page.statusCode,
      });
    }
  }
  
  return brokenLinks;
}

export function extractSFBacklinks(pages: any[]): { anchor?: string; pageTitle?: string; urlFrom?: string }[] {
  const backlinks: { anchor?: string; pageTitle?: string; urlFrom?: string }[] = [];
  
  for (const page of pages) {
    if (page.inboundLinks && Array.isArray(page.inboundLinks)) {
      for (const link of page.inboundLinks) {
        backlinks.push({
          anchor: link.anchor || link.text || '',
          pageTitle: link.title || page.title || '',
          urlFrom: link.url || link.fromUrl || '',
        });
      }
    }
  }
  
  return backlinks;
}

export function summarizeBacklinkHealth(results: BacklinkCheckResult[]): {
  overallScore: number;
  passed: number;
  failed: number;
  warnings: number;
  unknown: number;
} {
  let totalScore = 0;
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  let unknown = 0;

  for (const result of results) {
    totalScore += result.score;
    
    switch (result.status) {
      case 'pass':
        passed++;
        break;
      case 'fail':
        failed++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
        unknown++;
        break;
    }
  }

  return {
    overallScore: results.length > 0 ? Math.round(totalScore / results.length) : 0,
    passed,
    failed,
    warnings,
    unknown,
  };
}
