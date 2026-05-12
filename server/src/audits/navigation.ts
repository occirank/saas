import type { AuditCheck, AuditContext, CheckResult } from '../types.js';
import type { NavItem } from '../db/schema.js';

/**
 * Extract navigation structure from page
 */
export function extractNavigationStructure(ctx: AuditContext): {
  mainNav: NavItem[];
  footerNav: NavItem[];
  breadcrumbs: NavItem[];
  hasMainNav: boolean;
  hasFooterNav: boolean;
  hasBreadcrumb: boolean;
} {
  const { $, url } = ctx;
  const urlObj = new URL(url);
  const currentPath = urlObj.pathname;

  const mainNav: NavItem[] = [];
  const footerNav: NavItem[] = [];
  const breadcrumbs: NavItem[] = [];

  // Extract main navigation
  // Common patterns: <nav>, <header nav>, nav with role="navigation", .main-nav, #main-nav, .navbar
  const mainNavSelectors = [
    'nav',
    'header nav',
    '[role="navigation"]',
    '.main-nav',
    '#main-nav',
    '.navbar',
    '.primary-nav',
    '#primary-nav',
    '.top-nav',
    '.header-nav',
  ];

  let mainNavFound = false;
  for (const selector of mainNavSelectors) {
    const $nav = $(selector).first();
    if ($nav.length > 0 && !mainNavFound) {
      // Skip if this appears to be footer nav
      const isFooter = $nav.closest('footer').length > 0;
      if (!isFooter) {
        $nav.find('a[href]').each((_i, el) => {
          const $link = $(el);
          const href = $link.attr('href') || '';
          const text = $link.text().trim();
          
          if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            mainNav.push({
              text,
              href,
              level: 1,
              isCurrent: isCurrentPage(href, currentPath, urlObj.origin),
            });
          }
        });
        mainNavFound = mainNav.length > 0;
      }
    }
  }

  // Extract footer navigation
  const footerNavSelectors = [
    'footer nav',
    '.footer-nav',
    '#footer-nav',
    'footer .navigation',
    'footer ul',
  ];

  for (const selector of footerNavSelectors) {
    const $footerNav = $(selector).first();
    if ($footerNav.length > 0) {
      $footerNav.find('a[href]').each((_i, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const text = $link.text().trim();
        
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          footerNav.push({
            text,
            href,
            level: 1,
            isCurrent: isCurrentPage(href, currentPath, urlObj.origin),
          });
        }
      });
      if (footerNav.length > 0) break;
    }
  }

  // Extract breadcrumbs
  const breadcrumbSelectors = [
    'nav[aria-label*="breadcrumb"]',
    '.breadcrumb',
    '[class*="breadcrumb"]',
    '[itemtype*="BreadcrumbList"]',
    '.breadcrumbs',
    '#breadcrumbs',
  ];

  for (const selector of breadcrumbSelectors) {
    const $breadcrumb = $(selector).first();
    if ($breadcrumb.length > 0) {
      let level = 0;
      $breadcrumb.find('a[href]').each((_i, el) => {
        const $link = $(el);
        const href = $link.attr('href') || '';
        const text = $link.text().trim();
        
        if (text && href) {
          breadcrumbs.push({
            text,
            href,
            level: level++,
            isCurrent: isCurrentPage(href, currentPath, urlObj.origin),
          });
        }
      });
      if (breadcrumbs.length > 0) break;
    }
  }

  return {
    mainNav,
    footerNav,
    breadcrumbs,
    hasMainNav: mainNav.length > 0,
    hasFooterNav: footerNav.length > 0,
    hasBreadcrumb: breadcrumbs.length > 0,
  };
}

/**
 * Check if a link points to the current page
 */
function isCurrentPage(href: string, currentPath: string, baseOrigin: string): boolean {
  try {
    if (href.startsWith('/')) {
      return href === currentPath || href === currentPath.replace(/\/$/, '');
    }
    if (href.startsWith('http')) {
      const linkUrl = new URL(href);
      return linkUrl.pathname === currentPath;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract nested navigation items
 */
export function extractNestedNavItems(
  $: import('cheerio').CheerioAPI,
  $container: import('cheerio').Cheerio<any>,
  level: number = 1,
  parentHref?: string
): NavItem[] {
  const items: NavItem[] = [];
  const currentPath = '';

  $container.children('li, > a').each((_i: number, el: any) => {
    const $el = $(el);
    const $link = $el.is('a') ? $el : $el.find('> a').first();
    
    if ($link.length > 0) {
      const href = $link.attr('href') || '';
      const text = $link.text().trim();
      
      if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const item: NavItem = {
          text,
          href,
          level,
          parentHref,
          isCurrent: isCurrentPage(href, currentPath, ''),
        };
        items.push(item);

        // Check for nested lists
        const $nested = $el.find('> ul, > ol');
        if ($nested.length > 0) {
          const nestedItems = extractNestedNavItems($, $nested, level + 1, href);
          items.push(...nestedItems);
        }
      }
    }
  });

  return items;
}
/**
 * Check main navigation presence and quality
 */
export const checkMainNavigation: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const nav = extractNavigationStructure(ctx);

  if (!nav.hasMainNav) {
    return {
      id: 'main-navigation',
      name: 'Main Navigation',
      status: 'fail',
      score: 0,
      message: 'No main navigation found on the page.',
      details: 'A clear navigation menu helps users and search engines discover content.',
    };
  }

  if (nav.mainNav.length < 3) {
    return {
      id: 'main-navigation',
      name: 'Main Navigation',
      status: 'warning',
      score: 60,
      message: 'Limited main navigation.',
      details: `Only ${nav.mainNav.length} navigation items found. Consider adding more important pages to the main nav.`,
      value: `${nav.mainNav.length} items`,
    };
  }

  if (nav.mainNav.length > 10) {
    return {
      id: 'main-navigation',
      name: 'Main Navigation',
      status: 'warning',
      score: 70,
      message: 'Too many navigation items.',
      details: `${nav.mainNav.length} items may overwhelm users. Consider simplifying navigation.`,
      value: `${nav.mainNav.length} items`,
    };
  }

  return {
    id: 'main-navigation',
    name: 'Main Navigation',
    status: 'pass',
    score: 100,
    message: `Good main navigation with ${nav.mainNav.length} items.`,
    value: `${nav.mainNav.length} items`,
  };
};

/**
 * Check footer navigation presence
 */
export const checkFooterNavigation: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const nav = extractNavigationStructure(ctx);

  if (!nav.hasFooterNav) {
    return {
      id: 'footer-navigation',
      name: 'Footer Navigation',
      status: 'warning',
      score: 70,
      message: 'No footer navigation found.',
      details: 'Footer navigation provides secondary access to important pages and aids crawling.',
    };
  }

  // Check for important footer links
  const importantLinks = ['privacy', 'terms', 'contact', 'about', 'sitemap'];
  const foundImportant = importantLinks.filter(keyword =>
    nav.footerNav.some(item => 
      item.text.toLowerCase().includes(keyword) || 
      item.href.toLowerCase().includes(keyword)
    )
  );

  if (foundImportant.length < 2) {
    return {
      id: 'footer-navigation',
      name: 'Footer Navigation',
      status: 'warning',
      score: 70,
      message: 'Footer navigation missing important links.',
      details: `Consider adding links to: ${importantLinks.filter(l => !foundImportant.includes(l)).join(', ')}`,
      value: `${nav.footerNav.length} items`,
    };
  }

  return {
    id: 'footer-navigation',
    name: 'Footer Navigation',
    status: 'pass',
    score: 100,
    message: `Good footer navigation with ${nav.footerNav.length} items.`,
    value: `${nav.footerNav.length} items`,
  };
};

/**
 * Check breadcrumb presence and structure
 */
export const checkBreadcrumbs: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $, url } = ctx;
  const nav = extractNavigationStructure(ctx);
  const urlObj = new URL(url);
  const pathSegments = urlObj.pathname.split('/').filter(Boolean);

  // Breadcrumbs more important for deep pages
  if (pathSegments.length <= 1) {
    return {
      id: 'breadcrumbs',
      name: 'Breadcrumbs',
      status: 'pass',
      score: 100,
      message: 'Homepage or top-level page - breadcrumbs not critical.',
    };
  }

  if (!nav.hasBreadcrumb) {
    // Check if we're on a deep page without breadcrumbs
    if (pathSegments.length >= 2) {
      return {
        id: 'breadcrumbs',
        name: 'Breadcrumbs',
        status: 'warning',
        score: 60,
        message: 'No breadcrumbs found on deep page.',
        details: 'Breadcrumbs help users navigate and improve SEO for deep content.',
        value: `Depth: ${pathSegments.length}`,
      };
    }

    return {
      id: 'breadcrumbs',
      name: 'Breadcrumbs',
      status: 'warning',
      score: 70,
      message: 'No breadcrumbs found.',
      details: 'Consider adding breadcrumbs for better navigation and SEO.',
    };
  }

  // Validate breadcrumb structure matches URL
  const breadcrumbCount = nav.breadcrumbs.length;
  
  // Check for schema.org BreadcrumbList markup
  const hasSchema = $('[itemtype*="BreadcrumbList"]').length > 0;

  if (!hasSchema) {
    return {
      id: 'breadcrumbs',
      name: 'Breadcrumbs',
      status: 'warning',
      score: 80,
      message: 'Breadcrumbs present but missing schema markup.',
      details: 'Add BreadcrumbList schema for enhanced search results.',
      value: `${breadcrumbCount} items`,
    };
  }

  return {
    id: 'breadcrumbs',
    name: 'Breadcrumbs',
    status: 'pass',
    score: 100,
    message: `Good breadcrumb structure with schema markup.`,
    value: `${breadcrumbCount} items`,
  };
};

/**
 * Check navigation accessibility
 */
export const checkNavigationAccessibility: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const issues: string[] = [];
  let score = 100;

  // Check for ARIA labels on nav elements
  const $navs = $('nav');
  if ($navs.length > 1) {
    $navs.each((index, el) => {
      const $nav = $(el);
      const hasLabel = 
        $nav.attr('aria-label') || 
        $nav.attr('aria-labelledby') ||
        $nav.attr('role');
      
      if (!hasLabel && index > 0) {
        issues.push(`Nav #${index + 1} missing aria-label`);
        score -= 10;
      }
    });
  }

  // Check for current page indicator
  const $activeLinks = $('nav a.active, nav a[aria-current], nav .current a');
  if ($activeLinks.length === 0 && $navs.length > 0) {
    issues.push('No current page indicator in navigation');
    score -= 10;
  }

  // Check for keyboard accessibility (basic)
  const $navLinks = $('nav a');
  let missingTabIndex = 0;
  $navLinks.each((_i, el) => {
    const $link = $(el);
    // Links should have href for keyboard access
    if (!$link.attr('href') || $link.attr('href') === '#') {
      missingTabIndex++;
    }
  });

  if (missingTabIndex > 0) {
    issues.push(`${missingTabIndex} nav links missing proper href`);
    score -= 5;
  }

  if (issues.length === 0) {
    return {
      id: 'nav-accessibility',
      name: 'Navigation Accessibility',
      status: 'pass',
      score: 100,
      message: 'Navigation is accessible.',
    };
  }

  return {
    id: 'nav-accessibility',
    name: 'Navigation Accessibility',
    status: score >= 70 ? 'warning' : 'fail',
    score: Math.max(0, score),
    message: 'Navigation accessibility issues detected.',
    details: issues.join('\n'),
  };
};

// Export navigation checks as array
export const navigationChecks: AuditCheck[] = [
  checkMainNavigation,
  checkFooterNavigation,
  checkBreadcrumbs,
  checkNavigationAccessibility,
];
