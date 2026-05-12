import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

/**
 * Interface for URL architecture data
 */
export interface UrlArchitecture {
  baseUrl: string;
  categories: UrlCategory[];
  depthDistribution: Record<number, number>;
  avgDepth: number;
  maxDepth: number;
  issues: ArchitectureIssue[];
}

export interface UrlCategory {
  name: string;
  path: string;
  pageCount: number;
  avgDepth: number;
}

export interface ArchitectureIssue {
  type: 'deep-nesting' | 'inconsistent-structure' | 'long-url' | 'special-chars' | 'uppercase';
  url: string;
  severity: 'warning' | 'error';
  message: string;
}

/**
 * Analyze URL architecture for a list of URLs
 */
export function analyzeUrlArchitecture(urls: string[], baseUrl: string): UrlArchitecture {
  const urlObj = new URL(baseUrl);
  const baseOrigin = urlObj.origin;
  
  const categories: Map<string, { count: number; depths: number[] }> = new Map();
  const depthDistribution: Record<number, number> = {};
  const issues: ArchitectureIssue[] = [];
  
  let totalDepth = 0;
  let maxDepth = 0;

  for (const url of urls) {
    try {
      const parsedUrl = new URL(url);
      
      // Skip external URLs
      if (parsedUrl.origin !== baseOrigin) continue;
      
      const path = parsedUrl.pathname;
      const segments = path.split('/').filter(Boolean);
      const depth = segments.length;
      
      totalDepth += depth;
      maxDepth = Math.max(maxDepth, depth);
      depthDistribution[depth] = (depthDistribution[depth] || 0) + 1;
      
      // Categorize by first path segment
      if (segments.length > 0) {
        const category = segments[0];
        const existing = categories.get(category) || { count: 0, depths: [] };
        existing.count++;
        existing.depths.push(depth);
        categories.set(category, existing);
      }
      
      // Detect issues
      if (depth > 4) {
        issues.push({
          type: 'deep-nesting',
          url,
          severity: 'warning',
          message: `URL is deeply nested (${depth} levels). Consider flattening structure.`,
        });
      }
      
      if (path.length > 100) {
        issues.push({
          type: 'long-url',
          url,
          severity: 'warning',
          message: `URL is very long (${path.length} chars). Shorter URLs are better for SEO.`,
        });
      }
      
      // Check for special characters
      if (/[<>\"'`\\^{}|[\]]/.test(path)) {
        issues.push({
          type: 'special-chars',
          url,
          severity: 'error',
          message: 'URL contains special characters that may cause issues.',
        });
      }
      
      // Check for uppercase in path
      if (/[A-Z]/.test(path) && !path.includes('%')) {
        issues.push({
          type: 'uppercase',
          url,
          severity: 'warning',
          message: 'URL contains uppercase letters. Consider using lowercase.',
        });
      }
      
    } catch {
      // Invalid URL, skip
    }
  }

  // Build category results
  const categoryResults: UrlCategory[] = [];
  categories.forEach((data, name) => {
    categoryResults.push({
      name,
      path: `/${name}`,
      pageCount: data.count,
      avgDepth: data.depths.reduce((a, b) => a + b, 0) / data.depths.length,
    });
  });

  // Sort by page count
  categoryResults.sort((a, b) => b.pageCount - a.pageCount);

  return {
    baseUrl,
    categories: categoryResults,
    depthDistribution,
    avgDepth: urls.length > 0 ? totalDepth / urls.length : 0,
    maxDepth,
    issues,
  };
}

/**
 * Check URL structure for single page audit
 */
export const checkUrlStructure: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { url } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const segments = path.split('/').filter(Boolean);
  const depth = segments.length;
  
  const issues: string[] = [];
  let score = 100;

  // Check depth
  if (depth > 4) {
    issues.push(`Deep nesting: ${depth} levels`);
    score -= 15;
  }

  // Check URL length
  if (path.length > 100) {
    issues.push(`Long URL: ${path.length} chars`);
    score -= 10;
  }

  // Check for special characters
  if (/[<>\"'`\\^{}|[\]]/.test(path)) {
    issues.push('Contains special characters');
    score -= 20;
  }

  // Check for uppercase
  if (/[A-Z]/.test(path) && !path.includes('%')) {
    issues.push('Contains uppercase letters');
    score -= 5;
  }

  // Check for underscores (hyphens preferred)
  if (path.includes('_')) {
    issues.push('Uses underscores instead of hyphens');
    score -= 5;
  }

  // Check for file extensions (not ideal for modern URLs)
  if (/\.(html|php|aspx?)$/.test(path)) {
    issues.push('Contains file extension');
    score -= 5;
  }

  // Check for query parameters (can cause duplicate content)
  if (urlObj.search.length > 0) {
    issues.push('Has query parameters');
    score -= 10;
  }

  if (issues.length === 0) {
    return {
      id: 'url-structure',
      name: 'URL Structure',
      status: 'pass',
      score: 100,
      message: 'URL structure is clean and SEO-friendly.',
      value: `/${segments.join('/')}`,
    };
  }

  const status = score < 60 ? 'fail' : 'warning';
  
  return {
    id: 'url-structure',
    name: 'URL Structure',
    status,
    score: Math.max(0, score),
    message: 'URL structure issues detected.',
    details: issues.join('\n'),
    value: `Depth: ${depth}`,
  };
};

/**
 * Check URL depth for single page
 */
export const checkUrlDepth: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { url } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const segments = path.split('/').filter(Boolean);
  const depth = segments.length;

  if (depth === 0) {
    return {
      id: 'url-depth',
      name: 'URL Depth',
      status: 'pass',
      score: 100,
      message: 'Homepage (root level).',
      value: '0 levels',
    };
  }

  if (depth <= 2) {
    return {
      id: 'url-depth',
      name: 'URL Depth',
      status: 'pass',
      score: 100,
      message: `Good URL depth: ${depth} level${depth > 1 ? 's' : ''}.`,
      value: `${depth} levels`,
    };
  }

  if (depth <= 4) {
    return {
      id: 'url-depth',
      name: 'URL Depth',
      status: 'warning',
      score: 70,
      message: `Moderate URL depth: ${depth} levels.`,
      details: 'Ideally keep URLs at 2-3 levels deep for better crawlability.',
      value: `${depth} levels`,
    };
  }

  return {
    id: 'url-depth',
    name: 'URL Depth',
    status: 'fail',
    score: 40,
    message: `Deep URL structure: ${depth} levels.`,
    details: 'Consider flattening URL structure. Deep URLs are harder for search engines to crawl.',
    value: `${depth} levels`,
  };
};

/**
 * Check URL readability (human-readable slugs)
 */
export const checkUrlReadability: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { url } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return {
      id: 'url-readability',
      name: 'URL Readability',
      status: 'pass',
      score: 100,
      message: 'Homepage URL.',
    };
  }

  const issues: string[] = [];
  let score = 100;

  for (const segment of segments) {
    // Check for numeric IDs (like /product/12345)
    if (/^\d+$/.test(segment)) {
      issues.push('Contains numeric ID instead of descriptive slug');
      score -= 20;
    }
    
    // Check for UUIDs or random strings
    if (/^[a-f0-9]{32}$/i.test(segment.replace(/[-]/g, ''))) {
      issues.push('Contains UUID/hash instead of descriptive slug');
      score -= 25;
    }
    
    // Check for very long segments
    if (segment.length > 50) {
      issues.push('Contains very long URL segment');
      score -= 10;
    }
    
    // Check for excessive hyphens (keyword stuffing in URL)
    if ((segment.match(/-/g) || []).length > 5) {
      issues.push('Too many hyphens in URL segment');
      score -= 10;
    }
  }

  if (issues.length === 0) {
    return {
      id: 'url-readability',
      name: 'URL Readability',
      status: 'pass',
      score: 100,
      message: 'URL uses readable, descriptive slugs.',
      value: `/${segments.join('/')}`,
    };
  }

  return {
    id: 'url-readability',
    name: 'URL Readability',
    status: 'warning',
    score: Math.max(0, score),
    message: 'URL readability could be improved.',
    details: issues.join('\n'),
  };
};

// Export architecture checks as array
export const architectureChecks: AuditCheck[] = [
  checkUrlStructure,
  checkUrlDepth,
  checkUrlReadability,
];
