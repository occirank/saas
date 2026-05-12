import type { AuditCheck, AuditContext, CheckResult } from '../types.js';


export const linksChecks: AuditCheck[] = [
  checkInternalLinks,
  checkExternalLinks,
  checkBrokenLinks,
];

async function checkInternalLinks(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const baseUrl = new URL(url).origin;
  
  let internalLinks = 0;
  const uniquePaths = new Set<string>();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.origin === baseUrl) {
        internalLinks++;
        uniquePaths.add(linkUrl.pathname);
      }
    } catch {
      // Invalid URL, skip
    }
  });

  if (internalLinks === 0) {
    return {
      id: 'internal-links',
      name: 'Internal Links',
      status: 'warning',
      score: 50,
      message: 'No internal links found.',
      details: 'Add internal links to help search engines discover your content.',
    };
  }

  if (uniquePaths.size < 3) {
    return {
      id: 'internal-links',
      name: 'Internal Links',
      status: 'warning',
      score: 70,
      message: 'Limited internal linking structure.',
      details: 'Consider adding more internal links to related content.',
      value: `${internalLinks} links`,
    };
  }

  return {
    id: 'internal-links',
    name: 'Internal Links',
    status: 'pass',
    score: 100,
    message: 'Good internal linking structure.',
    value: `${internalLinks} links, ${uniquePaths.size} unique`,
  };
}

async function checkExternalLinks(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const baseUrl = new URL(url).origin;
  
  let externalLinks = 0;
  let nofollowLinks = 0;
  let noopenerLinks = 0;

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const rel = $(el).attr('rel') || '';
    
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.origin !== baseUrl && href.startsWith('http')) {
        externalLinks++;
        if (rel.includes('nofollow')) nofollowLinks++;
        if (rel.includes('noopener') || rel.includes('noreferrer')) noopenerLinks++;
      }
    } catch {
      // Invalid URL, skip
    }
  });

  if (externalLinks === 0) {
    return {
      id: 'external-links',
      name: 'External Links',
      status: 'pass',
      score: 100,
      message: 'No external links found.',
    };
  }

  const securePercent = (noopenerLinks / externalLinks) * 100;

  if (securePercent < 50) {
    return {
      id: 'external-links',
      name: 'External Links',
      status: 'warning',
      score: 60,
      message: 'External links lack security attributes.',
      details: 'Add rel="noopener noreferrer" to external links for security.',
      value: `${externalLinks} external`,
    };
  }

  return {
    id: 'external-links',
    name: 'External Links',
    status: 'pass',
    score: 100,
    message: 'External links are properly configured.',
    value: `${externalLinks} links`,
  };
}

async function checkBrokenLinks(ctx: AuditContext): Promise<CheckResult> {
  const { $, url } = ctx;
  const baseUrl = new URL(url).origin;
  
  const issues: string[] = [];
  let emptyLinks = 0;
  let javascriptLinks = 0;
  let hashOnlyLinks = 0;

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href')?.trim() || '';
    const text = $(el).text().trim();

    if (href === '' || href === '#') {
      emptyLinks++;
    } else if (href.startsWith('javascript:')) {
      javascriptLinks++;
    } else if (href === '#' && text === '') {
      hashOnlyLinks++;
    }
  });

  if (emptyLinks > 0) issues.push(`${emptyLinks} empty links`);
  if (javascriptLinks > 0) issues.push(`${javascriptLinks} javascript: links`);

  if (issues.length > 0) {
    return {
      id: 'broken-links',
      name: 'Link Quality',
      status: 'warning',
      score: 60,
      message: 'Some links may be problematic.',
      details: issues.join(', '),
    };
  }

  return {
    id: 'broken-links',
    name: 'Link Quality',
    status: 'pass',
    score: 100,
    message: 'All links appear to be valid.',
  };
}
