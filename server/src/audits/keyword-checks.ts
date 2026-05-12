import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

export interface KeywordPosition {
  keyword: string;
  found: boolean;
  positions: {
    title?: { found: boolean; position: number; exact: boolean };
    metaDescription?: { found: boolean; position: number; exact: boolean };
    h1?: { found: boolean; position: number; exact: boolean };
    content?: { found: boolean; count: number; firstPosition: number };
    url?: { found: boolean; exact: boolean };
  };
}

export interface KeywordCheckResult extends CheckResult {
  keywordPositions?: KeywordPosition[];
}

/**
 * Check keyword positions for a given keyword in the page context
 */
export function checkKeywordPositions(keyword: string, ctx: AuditContext): KeywordPosition {
  const { $, url, html } = ctx;
  const keywordLower = keyword.toLowerCase();
  
  const result: KeywordPosition = {
    keyword,
    found: false,
    positions: {},
  };

  // Check title
  const title = $('title').text() || '';
  const titleLower = title.toLowerCase();
  const titleIndex = titleLower.indexOf(keywordLower);
  result.positions.title = {
    found: titleIndex !== -1,
    position: titleIndex,
    exact: titleLower.includes(keywordLower),
  };

  // Check meta description
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const metaDescLower = metaDesc.toLowerCase();
  const metaIndex = metaDescLower.indexOf(keywordLower);
  result.positions.metaDescription = {
    found: metaIndex !== -1,
    position: metaIndex,
    exact: metaDescLower.includes(keywordLower),
  };

  // Check H1
  const h1 = $('h1').first().text() || '';
  const h1Lower = h1.toLowerCase();
  const h1Index = h1Lower.indexOf(keywordLower);
  result.positions.h1 = {
    found: h1Index !== -1,
    position: h1Index,
    exact: h1Lower.includes(keywordLower),
  };

  // Check content (body text)
  const bodyText = $('body').text() || '';
  const bodyLower = bodyText.toLowerCase();
  const contentIndex = bodyLower.indexOf(keywordLower);
  
  // Count occurrences
  let count = 0;
  let pos = bodyLower.indexOf(keywordLower);
  while (pos !== -1) {
    count++;
    pos = bodyLower.indexOf(keywordLower, pos + 1);
  }
  
  result.positions.content = {
    found: contentIndex !== -1,
    count,
    firstPosition: contentIndex,
  };

  // Check URL
  const urlLower = url.toLowerCase();
  const slugMatch = urlLower.match(/\/([^\/]+)\/?$/);
  const slug = slugMatch ? slugMatch[1].replace(/[-_]/g, ' ') : '';
  result.positions.url = {
    found: urlLower.includes(keywordLower),
    exact: slug === keywordLower || slug.includes(keywordLower),
  };

  // Set overall found status
  result.found = 
    result.positions.title?.found ||
    result.positions.metaDescription?.found ||
    result.positions.h1?.found ||
    result.positions.content?.found ||
    result.positions.url?.found ||
    false;

  return result;
}

/**
 * Check multiple keywords and return aggregated results
 */
export function checkMultipleKeywords(keywords: string[], ctx: AuditContext): KeywordPosition[] {
  return keywords.map(keyword => checkKeywordPositions(keyword, ctx));
}

/**
 * Audit check: Primary keyword in title
 */
export const checkKeywordInTitle: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const title = $('title').text() || '';
  
  // Get keywords from meta or data attribute (could be passed via context)
  const keywordsAttr = $('meta[name="keywords"]').attr('content') || '';
  const keywords = keywordsAttr.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keywords.length === 0) {
    return {
      id: 'keyword-in-title',
      name: 'Keyword in Title',
      status: 'warning',
      score: 70,
      message: 'No target keywords defined for this page.',
      details: 'Add target keywords to check their presence in the title.',
    };
  }

  const results = checkMultipleKeywords(keywords, ctx);
  const titleKeywords = results.filter(r => r.positions.title?.found);
  
  if (titleKeywords.length === 0) {
    return {
      id: 'keyword-in-title',
      name: 'Keyword in Title',
      status: 'fail',
      score: 0,
      message: 'No target keywords found in the page title.',
      details: `Target keywords: ${keywords.join(', ')}`,
      value: title.substring(0, 60),
    };
  }

  if (titleKeywords.length < keywords.length) {
    return {
      id: 'keyword-in-title',
      name: 'Keyword in Title',
      status: 'warning',
      score: 60,
      message: `${titleKeywords.length} of ${keywords.length} keywords found in title.`,
      details: `Found: ${titleKeywords.map(r => r.keyword).join(', ')}`,
      value: title.substring(0, 60),
    };
  }

  return {
    id: 'keyword-in-title',
    name: 'Keyword in Title',
    status: 'pass',
    score: 100,
    message: 'All target keywords found in the page title.',
    value: title.substring(0, 60),
  };
};

/**
 * Audit check: Primary keyword in meta description
 */
export const checkKeywordInMetaDescription: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const keywordsAttr = $('meta[name="keywords"]').attr('content') || '';
  const keywords = keywordsAttr.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keywords.length === 0) {
    return {
      id: 'keyword-in-meta',
      name: 'Keyword in Meta Description',
      status: 'warning',
      score: 70,
      message: 'No target keywords defined.',
    };
  }

  if (!metaDesc) {
    return {
      id: 'keyword-in-meta',
      name: 'Keyword in Meta Description',
      status: 'fail',
      score: 0,
      message: 'No meta description found.',
    };
  }

  const results = checkMultipleKeywords(keywords, ctx);
  const metaKeywords = results.filter(r => r.positions.metaDescription?.found);
  
  if (metaKeywords.length === 0) {
    return {
      id: 'keyword-in-meta',
      name: 'Keyword in Meta Description',
      status: 'fail',
      score: 30,
      message: 'No target keywords found in meta description.',
      details: `Target keywords: ${keywords.join(', ')}`,
    };
  }

  if (metaKeywords.length < keywords.length) {
    return {
      id: 'keyword-in-meta',
      name: 'Keyword in Meta Description',
      status: 'warning',
      score: 70,
      message: `${metaKeywords.length} of ${keywords.length} keywords found in meta description.`,
    };
  }

  return {
    id: 'keyword-in-meta',
    name: 'Keyword in Meta Description',
    status: 'pass',
    score: 100,
    message: 'All target keywords found in meta description.',
  };
};

/**
 * Audit check: Primary keyword in H1
 */
export const checkKeywordInH1: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const h1 = $('h1').first().text() || '';
  const keywordsAttr = $('meta[name="keywords"]').attr('content') || '';
  const keywords = keywordsAttr.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keywords.length === 0) {
    return {
      id: 'keyword-in-h1',
      name: 'Keyword in H1',
      status: 'warning',
      score: 70,
      message: 'No target keywords defined.',
    };
  }

  if (!h1) {
    return {
      id: 'keyword-in-h1',
      name: 'Keyword in H1',
      status: 'fail',
      score: 0,
      message: 'No H1 tag found on the page.',
    };
  }

  const results = checkMultipleKeywords(keywords, ctx);
  const h1Keywords = results.filter(r => r.positions.h1?.found);
  
  if (h1Keywords.length === 0) {
    return {
      id: 'keyword-in-h1',
      name: 'Keyword in H1',
      status: 'fail',
      score: 30,
      message: 'No target keywords found in H1 tag.',
      details: `H1: "${h1}" | Target: ${keywords.join(', ')}`,
    };
  }

  return {
    id: 'keyword-in-h1',
    name: 'Keyword in H1',
    status: 'pass',
    score: 100,
    message: `Primary keyword found in H1: "${h1}"`,
    value: h1.substring(0, 60),
  };
};

/**
 * Audit check: Keyword density in content
 */
export const checkKeywordDensity: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const bodyText = $('body').text() || '';
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  const keywordsAttr = $('meta[name="keywords"]').attr('content') || '';
  const keywords = keywordsAttr.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keywords.length === 0) {
    return {
      id: 'keyword-density',
      name: 'Keyword Density',
      status: 'warning',
      score: 70,
      message: 'No target keywords defined.',
    };
  }

  const results = checkMultipleKeywords(keywords, ctx);
  const densities: { keyword: string; density: number; count: number }[] = [];
  
  for (const result of results) {
    const count = result.positions.content?.count || 0;
    const density = wordCount > 0 ? (count / wordCount) * 100 : 0;
    densities.push({ keyword: result.keyword, density, count });
  }

  // Ideal keyword density is 1-2%
  const issues: string[] = [];
  let totalScore = 100;
  
  for (const d of densities) {
    if (d.count === 0) {
      issues.push(`"${d.keyword}": not found`);
      totalScore -= 30;
    } else if (d.density > 3) {
      issues.push(`"${d.keyword}": ${d.density.toFixed(1)}% (keyword stuffing risk)`);
      totalScore -= 20;
    } else if (d.density < 0.5) {
      issues.push(`"${d.keyword}": ${d.density.toFixed(1)}% (low)`);
      totalScore -= 10;
    }
  }

  if (issues.length > 0) {
    return {
      id: 'keyword-density',
      name: 'Keyword Density',
      status: issues.some(i => i.includes('not found')) ? 'fail' : 'warning',
      score: Math.max(0, totalScore),
      message: 'Keyword density issues detected.',
      details: issues.join('\n'),
      value: `${wordCount} words`,
    };
  }

  return {
    id: 'keyword-density',
    name: 'Keyword Density',
    status: 'pass',
    score: 100,
    message: 'Keyword density is optimal (1-2%).',
    value: `${wordCount} words`,
  };
};

/**
 * Audit check: Keyword in URL
 */
export const checkKeywordInUrl: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { url, $ } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  
  const keywordsFromMeta = $('meta[name="keywords"]').attr('content') || '';
  const allKeywords = keywordsFromMeta.split(',').map(k => k.trim()).filter(Boolean);
  
  if (allKeywords.length === 0) {
    return {
      id: 'keyword-in-url',
      name: 'Keyword in URL',
      status: 'warning',
      score: 70,
      message: 'No target keywords defined.',
    };
  }

  const pathLower = path.toLowerCase().replace(/[-_]/g, ' ');
  const foundKeywords = allKeywords.filter(k => pathLower.includes(k.toLowerCase()));
  
  if (foundKeywords.length === 0) {
    return {
      id: 'keyword-in-url',
      name: 'Keyword in URL',
      status: 'warning',
      score: 60,
      message: 'No target keywords found in URL slug.',
      details: `URL: ${path} | Target: ${allKeywords.join(', ')}`,
      value: path,
    };
  }

  return {
    id: 'keyword-in-url',
    name: 'Keyword in URL',
    status: 'pass',
    score: 100,
    message: `Keywords found in URL: ${foundKeywords.join(', ')}`,
    value: path,
  };
};

// Export all keyword checks as array
export const keywordChecks: AuditCheck[] = [
  checkKeywordInTitle,
  checkKeywordInMetaDescription,
  checkKeywordInH1,
  checkKeywordDensity,
  checkKeywordInUrl,
];
