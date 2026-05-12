import type { AuditContext, CheckResult } from '../types.js';

/**
 * Interface for orphan page detection results
 */
export interface OrphanPageResult {
  url: string;
  title?: string;
  inlinks: number;
  suggestedParent?: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Interface for site structure analysis
 */
export interface SiteStructureAnalysis {
  totalPages: number;
  orphanPages: OrphanPageResult[];
  lowInlinkPages: OrphanPageResult[];
  wellLinkedPages: number;
  avgInlinks: number;
  issues: string[];
}

/**
 * Analyze site structure from crawl data
 * Requires inlink count data from crawl
 */
export function analyzeSiteStructure(
  pages: Array<{ url: string; title?: string; inlinks?: number; depth?: number }>
): SiteStructureAnalysis {
  const orphanPages: OrphanPageResult[] = [];
  const lowInlinkPages: OrphanPageResult[] = [];
  let totalInlinks = 0;
  let wellLinkedPages = 0;

  for (const page of pages) {
    const inlinks = page.inlinks ?? 0;
    totalInlinks += inlinks;

    if (inlinks === 0) {
      orphanPages.push({
        url: page.url,
        title: page.title,
        inlinks: 0,
        priority: determineOrphanPriority(page),
        suggestedParent: suggestParentUrl(page.url, pages),
      });
    } else if (inlinks === 1) {
      lowInlinkPages.push({
        url: page.url,
        title: page.title,
        inlinks: 1,
        priority: 'low',
      });
    } else {
      wellLinkedPages++;
    }
  }

  const issues: string[] = [];
  if (orphanPages.length > 0) {
    issues.push(`${orphanPages.length} orphan pages with no internal links`);
  }
  if (lowInlinkPages.length > pages.length * 0.3) {
    issues.push(`${lowInlinkPages.length} pages have only 1 internal link`);
  }
  if (wellLinkedPages < pages.length * 0.5) {
    issues.push('Less than 50% of pages are well-linked');
  }

  return {
    totalPages: pages.length,
    orphanPages,
    lowInlinkPages,
    wellLinkedPages,
    avgInlinks: pages.length > 0 ? totalInlinks / pages.length : 0,
    issues,
  };
}

/**
 * Determine priority for orphan page based on URL patterns
 */
function determineOrphanPriority(
  page: { url: string; depth?: number }
): 'high' | 'medium' | 'low' {
  const url = page.url.toLowerCase();
  const depth = page.depth ?? 1;

  // High priority: important pages that should be linked
  if (
    url.includes('/about') ||
    url.includes('/contact') ||
    url.includes('/product') ||
    url.includes('/service') ||
    url.includes('/pricing') ||
    depth <= 2
  ) {
    return 'high';
  }

  // Medium priority: category or listing pages
  if (
    url.includes('/category') ||
    url.includes('/tag') ||
    url.includes('/archive') ||
    url.includes('/blog')
  ) {
    return 'medium';
  }

  return 'low';
}

/**
 * Suggest a parent URL based on URL structure
 */
function suggestParentUrl(
  orphanUrl: string,
  allPages: Array<{ url: string }>
): string | undefined {
  try {
    const orphanPath = new URL(orphanUrl).pathname;
    const segments = orphanPath.split('/').filter(Boolean);

    if (segments.length < 2) return undefined;

    // Look for parent directory
    const parentPath = '/' + segments.slice(0, -1).join('/');
    const parent = allPages.find(p => {
      try {
        return new URL(p.url).pathname === parentPath;
      } catch {
        return false;
      }
    });

    if (parent) return parent.url;

    // Look for sibling with similar path
    const category = segments[0];
    const sibling = allPages.find(p => {
      try {
        const siblingPath = new URL(p.url).pathname;
        const siblingSegments = siblingPath.split('/').filter(Boolean);
        return (
          siblingSegments[0] === category &&
          siblingSegments.length < segments.length
        );
      } catch {
        return false;
      }
    });

    return sibling?.url;
  } catch {
    return undefined;
  }
}

/**
 * Check for orphan pages on single page (limited check)
 * Full orphan detection requires crawl data
 */
export async function checkOrphanPage(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const segments = path.split('/').filter(Boolean);

  // Count how many internal links point to this specific page
  // This is a simplified check - we can only see if this page links to itself
  let selfReferences = 0;
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.pathname === path) {
        selfReferences++;
      }
    } catch {
      // Invalid URL
    }
  });

  // Deep pages without breadcrumbs might be orphan
  const hasBreadcrumb = $('nav[aria-label*="breadcrumb"], .breadcrumb, [class*="breadcrumb"]').length > 0;
  
  // Check if page appears to be deep with no breadcrumb
  if (segments.length > 2 && !hasBreadcrumb) {
    return {
      id: 'orphan-risk',
      name: 'Orphan Page Risk',
      status: 'warning',
      score: 60,
      message: 'Deep page without breadcrumb navigation.',
      details: 'This page may be difficult to discover. Consider adding internal links from relevant pages.',
      value: `Depth: ${segments.length}`,
    };
  }

  // Check for isolation indicators
  const internalLinks = $('a[href]').filter((_i, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, url);
      return linkUrl.origin === urlObj.origin;
    } catch {
      return false;
    }
  }).length;

  if (internalLinks < 3) {
    return {
      id: 'orphan-risk',
      name: 'Orphan Page Risk',
      status: 'warning',
      score: 70,
      message: 'Page has few internal links.',
      details: 'Consider adding more internal links to connect this page with the rest of the site.',
      value: `${internalLinks} internal links`,
    };
  }

  return {
    id: 'orphan-risk',
    name: 'Orphan Page Risk',
    status: 'pass',
    score: 100,
    message: 'Page appears well-connected internally.',
    value: `${internalLinks} internal links`,
  };
}

/**
 * Check internal linking structure
 */
export async function checkInternalLinkingStructure(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const urlObj = new URL(url);
  
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.origin === urlObj.origin) {
        internalLinks.push(linkUrl.pathname);
      } else if (href.startsWith('http')) {
        externalLinks.push(linkUrl.hostname);
      }
    } catch {
      // Invalid URL
    }
  });

  const uniqueInternal = new Set(internalLinks).size;
  const ratio = internalLinks.length > 0 
    ? uniqueInternal / internalLinks.length 
    : 0;

  if (uniqueInternal < 5) {
    return {
      id: 'internal-linking',
      name: 'Internal Linking',
      status: 'warning',
      score: 60,
      message: 'Limited internal linking structure.',
      details: `Found links to ${uniqueInternal} unique internal pages. Consider adding more diverse internal links.`,
      value: `${uniqueInternal} unique pages`,
    };
  }

  if (ratio < 0.3) {
    return {
      id: 'internal-linking',
      name: 'Internal Linking',
      status: 'warning',
      score: 70,
      message: 'Many duplicate internal links.',
      details: 'Consider diversifying internal links to spread link equity.',
    };
  }

  return {
    id: 'internal-linking',
    name: 'Internal Linking',
    status: 'pass',
    score: 100,
    message: `Good internal linking: ${uniqueInternal} unique pages linked.`,
    value: `${uniqueInternal} unique`,
  };
}

/**
 * Check for silo structure (thematic grouping)
 */
export async function checkSiloStructure(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  const segments = path.split('/').filter(Boolean);

  // Check if links follow silo structure
  let sameCategoryLinks = 0;
  let differentCategoryLinks = 0;
  const currentCategory = segments[0] || '';

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.origin === urlObj.origin) {
        const linkSegments = linkUrl.pathname.split('/').filter(Boolean);
        const linkCategory = linkSegments[0] || '';
        
        if (linkCategory === currentCategory) {
          sameCategoryLinks++;
        } else if (linkCategory) {
          differentCategoryLinks++;
        }
      }
    } catch {
      // Invalid URL
    }
  });

  // Homepage or root level - check for category links
  if (segments.length === 0) {
    return {
      id: 'silo-structure',
      name: 'Silo Structure',
      status: 'pass',
      score: 100,
      message: 'Homepage - entry point to all silos.',
    };
  }

  // Good silo structure has more same-category links
  if (sameCategoryLinks >= differentCategoryLinks && sameCategoryLinks > 0) {
    return {
      id: 'silo-structure',
      name: 'Silo Structure',
      status: 'pass',
      score: 100,
      message: `Good silo structure: ${sameCategoryLinks} same-category links.`,
    };
  }

  if (sameCategoryLinks === 0 && differentCategoryLinks > 3) {
    return {
      id: 'silo-structure',
      name: 'Silo Structure',
      status: 'warning',
      score: 60,
      message: 'Weak silo structure.',
      details: 'Consider linking more to pages within the same category/topic.',
    };
  }

  return {
    id: 'silo-structure',
    name: 'Silo Structure',
    status: 'pass',
    score: 80,
    message: 'Adequate internal linking structure.',
  };
}

// Export site structure checks
export const siteStructureChecks = [
  checkOrphanPage,
  checkInternalLinkingStructure,
  checkSiloStructure,
];
