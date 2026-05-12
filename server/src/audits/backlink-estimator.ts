import type { TrendAnalysis, TldAnalysisResult, TldDistribution, BacklinkCheckResult } from '../ahrefs/types.js';
import type { RefdomainsHistoryPoint } from '../ahrefs/types.js';

export function analyzeRefdomainsTrend(history: RefdomainsHistoryPoint[]): TrendAnalysis {
  if (!history || history.length < 2) {
    return {
      direction: 'stable',
      slope: 0,
      percentChange: 0,
      hasSpike: false,
      hasDrop: false,
      hasSpikeDrop: false,
    };
  }

  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const first = sorted[0].refdomains;
  const last = sorted[sorted.length - 1].refdomains;
  const percentChange = first > 0 ? ((last - first) / first) * 100 : 0;

  const n = sorted.length;
  // Linear regression: use index-based x values (0, 1, 2, ...) for slope calculation
  const sumX = (n * (n - 1)) / 2;
  const sumY = sorted.reduce((acc, p) => acc + p.refdomains, 0);
  const sumXY = sorted.reduce((acc, p, i) => acc + p.refdomains * i, 0);
  const sumX2 = sorted.reduce((acc, p, i) => acc + i * i, 0);
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

  return {
    direction: slope > 0.5 ? 'positive' : slope < -0.5 ? 'negative' : 'stable',
    slope,
    percentChange,
    hasSpike: false,
    hasDrop: false,
    hasSpikeDrop: false,
  };
}

export function checkRapidGain(trend: TrendAnalysis): BacklinkCheckResult {
  const answer = trend.hasSpike ? 'yes' : 'no';
  const status = trend.hasSpike ? 'warning' : 'pass';
  const details = trend.hasSpike
    ? `Rapid gain detected: +${trend.spikePercent?.toFixed(1)}% on ${trend.spikeDate}`
    : 'No rapid gain in referring domains detected';

  return {
    questionId: 'Q55',
    question: 'Y a t-il un gain rapide en termes de domaines référents?',
    answer,
    status,
    score: trend.hasSpike ? 50 : 100,
    details,
    metrics: {
      spikePercent: trend.spikePercent || 0,
      spikeDate: trend.spikeDate || '',
    },
    recommendation: trend.hasSpike
      ? 'Investigate the source of rapid backlink growth - could indicate PBN or unnatural link building'
      : undefined,
  };
}

export function checkRapidDrop(trend: TrendAnalysis): BacklinkCheckResult {
  const answer = trend.hasDrop ? 'yes' : 'no';
  const status = trend.hasDrop ? 'fail' : 'pass';
  const details = trend.hasDrop
    ? `Drop detected: ${trend.dropPercent?.toFixed(1)}% on ${trend.dropDate}`
    : 'No significant drop in referring domains detected';

  return {
    questionId: 'Q56',
    question: 'Y a t-il une chute en termes de domaines référents?',
    answer,
    status,
    score: trend.hasDrop ? 30 : 100,
    details,
    metrics: {
      dropPercent: trend.dropPercent || 0,
      dropDate: trend.dropDate || '',
    },
    recommendation: trend.hasDrop
      ? 'Investigate lost backlinks - check for removed content, broken partnerships, or negative SEO'
      : undefined,
  };
}

export function checkSpikeDropPattern(trend: TrendAnalysis): BacklinkCheckResult {
  const answer = trend.hasSpikeDrop ? 'yes' : 'no';
  const status = trend.hasSpikeDrop ? 'fail' : 'pass';
  const details = trend.hasSpikeDrop
    ? `Spike-drop pattern detected: +${trend.spikePercent?.toFixed(1)}% then ${trend.dropPercent?.toFixed(1)}%`
    : 'No spike-drop pattern detected';

  return {
    questionId: 'Q57',
    question: 'Y a t-il un pic (gain rapide suivi d\'une chute) en termes de domaines référents?',
    answer,
    status,
    score: trend.hasSpikeDrop ? 20 : 100,
    details,
    metrics: {
      spikePercent: trend.spikePercent || 0,
      dropPercent: trend.dropPercent || 0,
    },
    recommendation: trend.hasSpikeDrop
      ? 'PBN deindexation or link scheme detection likely - audit backlink sources immediately'
      : undefined,
  };
}

export function checkPositiveTrend(trend: TrendAnalysis): BacklinkCheckResult {
  const answer = trend.direction === 'positive' ? 'yes' : trend.direction === 'stable' ? 'partial' : 'no';
  const status = trend.direction === 'positive' ? 'pass' : trend.direction === 'stable' ? 'warning' : 'fail';
  const details = `Overall trend: ${trend.direction} (${trend.percentChange >= 0 ? '+' : ''}${trend.percentChange.toFixed(1)}%)`;

  return {
    questionId: 'Q58',
    question: 'Est-ce que la courbe d\'évolution des domaines référents est positive?',
    answer,
    status,
    score: trend.direction === 'positive' ? 100 : trend.direction === 'stable' ? 70 : 40,
    details,
    metrics: {
      percentChange: trend.percentChange,
      slope: trend.slope,
    },
    recommendation: trend.direction !== 'positive'
      ? 'Focus on sustainable link building strategies - guest posts, PR, content marketing'
      : undefined,
  };
}

const SPONSORED_KEYWORDS = [
  'sponsorisé', 'sponsored', 'publicité', 'advertisement', 'ad',
  'partenaire', 'partner', 'affiliation', 'affiliate', 'paid',
  'acheté', 'bought', 'offert', 'offered', 'promo', 'promotion',
];

const DIRECTORY_KEYWORDS = [
  'annuaire', 'directory', 'répertoire', 'listing', 'liste',
  'catalogue', 'catalog', 'soumettre', 'submit', 'add url',
  'ajouter site', 'add site', 'liens', 'links', 'resources',
  'partenaires', 'partners', 'sites recommandés', 'recommended',
];

export function estimateAnchorOveruse(anchors: { anchor: string; count: number }[], threshold: number = 15): BacklinkCheckResult {
  if (!anchors || anchors.length === 0) {
    return {
      questionId: 'Q59',
      question: 'Est-ce qu\'un même mot ou une même phrase est utilisée trop fréquemment dans les ancres de lien des backlinks?',
      answer: 'unknown',
      status: 'info',
      score: 50,
      details: 'No anchor text data available',
    };
  }

  const total = anchors.reduce((sum, a) => sum + a.count, 0);
  const overusedAnchors = anchors.filter(a => (a.count / total) * 100 > threshold);
  const hasOveruse = overusedAnchors.length > 0;

  const answer = hasOveruse ? 'yes' : 'no';
  const status = hasOveruse ? 'fail' : 'pass';
  const details = hasOveruse
    ? `Overused anchors found: ${overusedAnchors.map(a => `"${a.anchor}" (${((a.count / total) * 100).toFixed(1)}%)`).join(', ')}`
    : 'Anchor text distribution appears natural';

  return {
    questionId: 'Q59',
    question: 'Est-ce qu\'un même mot ou une même phrase est utilisée trop fréquemment dans les ancres de lien des backlinks?',
    answer,
    status,
    score: hasOveruse ? 30 : 100,
    details,
    metrics: {
      overusedCount: overusedAnchors.length,
      threshold,
    },
    recommendation: hasOveruse
      ? 'Diversify anchor text - aim for branded, natural, and varied anchors instead of exact match keywords'
      : undefined,
  };
}

export function estimateTldMismatch(
  refdomains: { domain: string }[],
  targetCountry: string = 'fr'
): BacklinkCheckResult {
  const countryTldMap: Record<string, string[]> = {
    fr: ['fr', 're', 'pf', 'nc', 'be', 'ch', 'lu', 'mc'],
    us: ['com', 'us', 'net', 'org', 'io'],
    uk: ['uk', 'co.uk'],
    de: ['de', 'at', 'ch'],
    es: ['es', 'mx', 'ar'],
    it: ['it'],
  };

  if (!refdomains || refdomains.length === 0) {
    return {
      questionId: 'Q60',
      question: 'Est-ce que plus de 25% des domaines référents ont une extension (TLD) ne correspondant pas au pays principal ciblé?',
      answer: 'unknown',
      status: 'info',
      score: 50,
      details: 'No referring domain data available',
    };
  }

  const localTlds = countryTldMap[targetCountry] || [targetCountry];
  let mismatchCount = 0;

  for (const { domain } of refdomains) {
    const tld = domain.split('.').pop()?.toLowerCase() || '';
    if (!localTlds.includes(tld)) {
      mismatchCount++;
    }
  }

  const mismatchPercentage = (mismatchCount / refdomains.length) * 100;
  const hasMismatch = mismatchPercentage > 25;

  const answer = hasMismatch ? 'yes' : 'no';
  const status = hasMismatch ? 'warning' : 'pass';
  const details = `${mismatchPercentage.toFixed(1)}% of referring domains have non-local TLDs`;

  return {
    questionId: 'Q60',
    question: 'Est-ce que plus de 25% des domaines référents ont une extension (TLD) ne correspondant pas au pays principal ciblé?',
    answer,
    status,
    score: hasMismatch ? 60 : 100,
    details,
    metrics: {
      mismatchPercentage,
      mismatchCount,
      totalCount: refdomains.length,
    },
    recommendation: hasMismatch
      ? 'Focus link building on locally relevant domains to improve geographic relevance'
      : undefined,
  };
}

export function checkBrokenBacklinks(brokenLinks: { url: string; statusCode: number }[]): BacklinkCheckResult {
  const has404s = brokenLinks.some(link => link.statusCode === 404);
  const count404 = brokenLinks.filter(link => link.statusCode === 404).length;

  const answer = has404s ? 'yes' : 'no';
  const status = has404s ? 'fail' : 'pass';
  const details = has404s
    ? `Found ${count404} backlinks pointing to 404 pages`
    : 'No backlinks pointing to 404 pages found';

  return {
    questionId: 'Q61',
    question: 'Y a t-il des backlinks pointant vers des pages retournant un code erreur 404?',
    answer,
    status,
    score: has404s ? 40 : 100,
    details,
    metrics: {
      brokenCount: count404,
      totalBrokenLinks: brokenLinks.length,
    },
    recommendation: has404s
      ? 'Implement 301 redirects for broken pages to reclaim link equity, or recreate the content'
      : undefined,
  };
}

export function checkLowQualityRefdomains(
  refdomains: { domain: string; domainRating?: number; isSpam?: boolean }[],
  drThreshold: number = 20
): BacklinkCheckResult {
  if (!refdomains || refdomains.length === 0) {
    return {
      questionId: 'Q62',
      question: 'Y a t-il des domaines référents de mauvaise qualité?',
      answer: 'unknown',
      status: 'info',
      score: 50,
      details: 'No referring domain quality data available',
    };
  }

  const lowQuality = refdomains.filter(rd => 
    (rd.domainRating !== undefined && rd.domainRating < drThreshold) || rd.isSpam === true
  );
  const spamCount = refdomains.filter(rd => rd.isSpam === true).length;
  const hasLowQuality = lowQuality.length > refdomains.length * 0.3;

  const answer = hasLowQuality ? 'yes' : 'no';
  const status = hasLowQuality ? 'warning' : 'pass';
  const details = `${lowQuality.length} low-quality domains (${((lowQuality.length / refdomains.length) * 100).toFixed(1)}%)${spamCount > 0 ? `, including ${spamCount} spam domains` : ''}`;

  return {
    questionId: 'Q62',
    question: 'Y a t-il des domaines référents de mauvaise qualité?',
    answer,
    status,
    score: hasLowQuality ? 50 : 100,
    details,
    metrics: {
      lowQualityCount: lowQuality.length,
      spamCount,
      drThreshold,
    },
    recommendation: hasLowQuality
      ? 'Consider disavowing toxic domains and focus on building relationships with high-authority sites'
      : undefined,
  };
}

export function estimateSponsoredLinksWithoutNofollow(
  backlinks: { anchor?: string; pageTitle?: string; urlFrom?: string }[]
): BacklinkCheckResult {
  if (!backlinks || backlinks.length === 0) {
    return {
      questionId: 'Q63',
      question: 'Est-ce que certains backlinks sont achetés/sponsorisés sans directive "nofollow"?',
      answer: 'unknown',
      status: 'info',
      score: 50,
      details: 'No backlink data available for analysis',
    };
  }

  const sponsoredPatterns = backlinks.filter(bl => {
    const anchorLower = (bl.anchor || '').toLowerCase();
    const titleLower = (bl.pageTitle || '').toLowerCase();
    return SPONSORED_KEYWORDS.some(kw => 
      anchorLower.includes(kw) || titleLower.includes(kw)
    );
  });

  const hasSponsored = sponsoredPatterns.length > 0;

  const answer = hasSponsored ? 'yes' : 'no';
  const status = hasSponsored ? 'warning' : 'pass';
  const details = hasSponsored
    ? `Found ${sponsoredPatterns.length} potentially sponsored links (based on anchor/page patterns)`
    : 'No obviously sponsored links detected';

  return {
    questionId: 'Q63',
    question: 'Est-ce que certains backlinks sont achetés/sponsorisés sans directive "nofollow"?',
    answer,
    status,
    score: hasSponsored ? 40 : 100,
    details,
    metrics: {
      suspectedCount: sponsoredPatterns.length,
      totalChecked: backlinks.length,
    },
    recommendation: hasSponsored
      ? 'Review suspected sponsored links - ensure all paid placements have rel="sponsored" or rel="nofollow"'
      : undefined,
  };
}

export function estimateDirectoryLinks(
  backlinks: { pageTitle?: string; urlFrom?: string; anchor?: string }[]
): BacklinkCheckResult {
  if (!backlinks || backlinks.length === 0) {
    return {
      questionId: 'Q64',
      question: 'Y a t-il des backlinks provenant d\'annuaires généralistes qui acceptent toutes les inscriptions?',
      answer: 'unknown',
      status: 'info',
      score: 50,
      details: 'No backlink data available for analysis',
    };
  }

  const directoryLinks = backlinks.filter(bl => {
    const titleLower = (bl.pageTitle || '').toLowerCase();
    const urlLower = (bl.urlFrom || '').toLowerCase();
    const anchorLower = (bl.anchor || '').toLowerCase();
    return DIRECTORY_KEYWORDS.some(kw =>
      titleLower.includes(kw) || urlLower.includes(kw) || anchorLower.includes(kw)
    );
  });

  const hasDirectoryLinks = directoryLinks.length > 0;

  const answer = hasDirectoryLinks ? 'yes' : 'no';
  const status = hasDirectoryLinks ? 'warning' : 'pass';
  const details = hasDirectoryLinks
    ? `Found ${directoryLinks.length} potential directory links`
    : 'No obvious directory links detected';

  return {
    questionId: 'Q64',
    question: 'Y a t-il des backlinks provenant d\'annuaires généralistes qui acceptent toutes les inscriptions?',
    answer,
    status,
    score: hasDirectoryLinks ? 60 : 100,
    details,
    metrics: {
      directoryCount: directoryLinks.length,
      totalChecked: backlinks.length,
    },
    recommendation: hasDirectoryLinks
      ? 'Low-quality directory links provide little value - focus on niche-specific and editorial links'
      : undefined,
  };
}

export function generateBacklinkAnswers(
  ahrefsData: {
    refdomainsHistory: RefdomainsHistoryPoint[];
    domainRating: number;
    totalRefdomains: number;
  },
  sfData: {
    brokenLinks: { url: string; statusCode: number }[];
  }
): BacklinkCheckResult[] {
  const trend = analyzeRefdomainsTrend(ahrefsData.refdomainsHistory);

  return [
    checkRapidGain(trend),
    checkRapidDrop(trend),
    checkSpikeDropPattern(trend),
    checkPositiveTrend(trend),
    estimateAnchorOveruse([]),
    estimateTldMismatch([]),
    checkBrokenBacklinks(sfData.brokenLinks),
    checkLowQualityRefdomains([]),
    estimateSponsoredLinksWithoutNofollow([]),
    estimateDirectoryLinks([]),
  ];
}
