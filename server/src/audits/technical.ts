import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

export const technicalChecks: AuditCheck[] = [
  checkHttps,
  checkRobotsTxt,
  checkSitemap,
  checkStatusCode,
  checkResponseTime,
  checkContentType,
  checkMetaRefresh,
  checkRedirectChains,
];

async function checkHttps(ctx: AuditContext): Promise<CheckResult> {
  const { url } = ctx;
  const isHttps = url.startsWith('https://');

  if (!isHttps) {
    return {
      id: 'https',
      name: 'HTTPS',
      status: 'fail',
      score: 0,
      message: 'Site is not using HTTPS.',
      details: 'Migrate to HTTPS for security and SEO benefits.',
    };
  }

  return {
    id: 'https',
    name: 'HTTPS',
    status: 'pass',
    score: 100,
    message: 'Site is secured with HTTPS.',
  };
}

async function checkRobotsTxt(ctx: AuditContext): Promise<CheckResult> {
  const { robotsTxt } = ctx;

  if (!robotsTxt) {
    return {
      id: 'robots-txt',
      name: 'robots.txt',
      status: 'warning',
      score: 50,
      message: 'No robots.txt file found.',
      details: 'Add a robots.txt file to control crawler access.',
    };
  }

  if (robotsTxt.includes('Disallow: /')) {
    return {
      id: 'robots-txt',
      name: 'robots.txt',
      status: 'warning',
      score: 30,
      message: 'robots.txt blocks all crawlers.',
      details: 'Check your robots.txt - it may be blocking search engine indexing.',
    };
  }

  return {
    id: 'robots-txt',
    name: 'robots.txt',
    status: 'pass',
    score: 100,
    message: 'robots.txt file is present and properly configured.',
  };
}

async function checkSitemap(ctx: AuditContext): Promise<CheckResult> {
  const { sitemapXml } = ctx;

  if (!sitemapXml) {
    return {
      id: 'sitemap',
      name: 'XML Sitemap',
      status: 'warning',
      score: 60,
      message: 'No sitemap.xml found.',
      details: 'Add an XML sitemap to help search engines discover your pages.',
    };
  }

  // Basic validation
  if (!sitemapXml.includes('<urlset') && !sitemapXml.includes('<sitemapindex')) {
    return {
      id: 'sitemap',
      name: 'XML Sitemap',
      status: 'warning',
      score: 50,
      message: 'Sitemap file exists but may be invalid.',
      details: 'Ensure sitemap.xml contains valid XML with urlset or sitemapindex.',
    };
  }

  return {
    id: 'sitemap',
    name: 'XML Sitemap',
    status: 'pass',
    score: 100,
    message: 'XML sitemap is present.',
  };
}

async function checkStatusCode(ctx: AuditContext): Promise<CheckResult> {
  const { statusCode } = ctx;

  if (statusCode >= 400) {
    return {
      id: 'status-code',
      name: 'HTTP Status',
      status: 'fail',
      score: 0,
      message: `Page returned status ${statusCode}.`,
      details: 'Ensure the page returns a 200 OK status code.',
      value: `${statusCode}`,
    };
  }

  if (statusCode >= 300) {
    return {
      id: 'status-code',
      name: 'HTTP Status',
      status: 'warning',
      score: 70,
      message: `Page redirects with status ${statusCode}.`,
      value: `${statusCode}`,
    };
  }

  return {
    id: 'status-code',
    name: 'HTTP Status',
    status: 'pass',
    score: 100,
    message: 'Page returns successful HTTP status.',
    value: `${statusCode}`,
  };
}

async function checkResponseTime(ctx: AuditContext): Promise<CheckResult> {
  const { responseTime } = ctx;

  if (responseTime > 3000) {
    return {
      id: 'response-time',
      name: 'Server Response Time',
      status: 'fail',
      score: 30,
      message: `Very slow response time: ${responseTime}ms.`,
      details: 'Optimize server performance. Target under 1000ms.',
      value: `${responseTime}ms`,
    };
  }

  if (responseTime > 1000) {
    return {
      id: 'response-time',
      name: 'Server Response Time',
      status: 'warning',
      score: 60,
      message: `Response time could be improved: ${responseTime}ms.`,
      details: 'Consider server optimizations for faster response.',
      value: `${responseTime}ms`,
    };
  }

  return {
    id: 'response-time',
    name: 'Server Response Time',
    status: 'pass',
    score: 100,
    message: 'Fast server response time.',
    value: `${responseTime}ms`,
  };
}

async function checkContentType(ctx: AuditContext): Promise<CheckResult> {
  const { headers } = ctx;
  const contentType = headers['content-type'] || '';

  if (!contentType) {
    return {
      id: 'content-type',
      name: 'Content-Type Header',
      status: 'warning',
      score: 70,
      message: 'No Content-Type header found.',
      details: 'Add proper Content-Type header for better browser handling.',
    };
  }

  if (!contentType.includes('text/html')) {
    return {
      id: 'content-type',
      name: 'Content-Type Header',
      status: 'warning',
      score: 50,
      message: `Content-Type is not HTML: ${contentType}`,
      details: 'SEO audit works best with HTML content.',
      value: contentType.split(';')[0],
    };
  }

  return {
    id: 'content-type',
    name: 'Content-Type Header',
    status: 'pass',
    score: 100,
    message: 'Proper Content-Type header is set.',
    value: 'text/html',
  };
}


async function checkMetaRefresh(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  // Check for meta refresh redirect
  const metaRefresh = $('meta[http-equiv="refresh"]');
  
  if (metaRefresh.length === 0) {
    return {
      id: 'meta-refresh',
      name: 'Meta Refresh Redirects',
      status: 'pass',
      score: 100,
      message: 'No meta refresh redirects detected.',
    };
  }
  
  // Extract delay and URL from content attribute
  const content = metaRefresh.attr('content') || '';
  const delayMatch = content.match(/^(\d+)/);
  const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;
  
  // Meta refresh is problematic for SEO, especially with short delays
  if (delay < 5) {
    return {
      id: 'meta-refresh',
      name: 'Meta Refresh Redirects',
      status: 'fail',
      score: 0,
      message: `Meta refresh redirect detected with short delay (${delay}s).`,
      details: 'Meta refresh redirects are not recommended for SEO. Use server-side 301 redirects instead.',
      value: `${delay}s delay`,
    };
  }
  
  return {
    id: 'meta-refresh',
    name: 'Meta Refresh Redirects',
    status: 'warning',
    score: 50,
    message: `Meta refresh redirect detected with delay of ${delay}s.`,
    details: 'Meta refresh redirects are discouraged for SEO. Consider using server-side 301 redirects instead.',
    value: `${delay}s delay`,
  };
}


async function checkRedirectChains(ctx: AuditContext): Promise<CheckResult> {
  const { redirectChain } = ctx;
  
  // No redirects occurred
  if (!redirectChain || redirectChain.length === 0) {
    return {
      id: 'redirect-chains',
      name: 'Redirect Chains',
      status: 'pass',
      score: 100,
      message: 'No redirects detected on this page.',
    };
  }
  
  // Single redirect is acceptable
  if (redirectChain.length === 1) {
    const redirect = redirectChain[0];
    return {
      id: 'redirect-chains',
      name: 'Redirect Chains',
      status: 'pass',
      score: 100,
      message: `Single redirect detected (${redirect.statusCode}).`,
      details: `Redirect from ${redirect.url}`,
      value: '1 redirect',
    };
  }
  
  // Multiple redirects = redirect chain (bad for SEO)
  const chainDescription = redirectChain.map(r => `${r.statusCode} → ${r.url}`).join('\n');
  
  if (redirectChain.length >= 3) {
    return {
      id: 'redirect-chains',
      name: 'Redirect Chains',
      status: 'fail',
      score: 0,
      message: `Long redirect chain detected (${redirectChain.length} redirects).`,
      details: `Redirect chain:\n${chainDescription}\n\nRedirect chains slow down page load and dilute link equity. Update to direct links.`,
      value: `${redirectChain.length} redirects`,
    };
  }
  
  // 2 redirects is a warning
  return {
    id: 'redirect-chains',
    name: 'Redirect Chains',
    status: 'warning',
    score: 50,
    message: `Redirect chain detected (${redirectChain.length} redirects).`,
    details: `Redirect chain:\n${chainDescription}\n\nConsider updating to a single direct redirect.`,
    value: `${redirectChain.length} redirects`,
  };
}
