import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

export const performanceChecks: AuditCheck[] = [
  checkPageSize,
  checkResourceCount,
  checkCompression,
  checkCaching,
];

async function checkPageSize(ctx: AuditContext): Promise<CheckResult> {
  const { html } = ctx;
  const pageSizeKB = Buffer.byteLength(html, 'utf8') / 1024;

  if (pageSizeKB > 500) {
    return {
      id: 'page-size',
      name: 'Page Size',
      status: 'fail',
      score: 30,
      message: `Page size is very large: ${Math.round(pageSizeKB)}KB.`,
      details: 'Reduce HTML size by removing unused code and minifying.',
      value: `${Math.round(pageSizeKB)}KB`,
    };
  }

  if (pageSizeKB > 200) {
    return {
      id: 'page-size',
      name: 'Page Size',
      status: 'warning',
      score: 60,
      message: `Page size could be smaller: ${Math.round(pageSizeKB)}KB.`,
      details: 'Consider minifying HTML and removing unused markup.',
      value: `${Math.round(pageSizeKB)}KB`,
    };
  }

  return {
    id: 'page-size',
    name: 'Page Size',
    status: 'pass',
    score: 100,
    message: 'Page size is reasonable.',
    value: `${Math.round(pageSizeKB)}KB`,
  };
}

async function checkResourceCount(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const scripts = $('script[src]').length;
  const styles = $('link[rel="stylesheet"]').length;
  const images = $('img[src]').length;
  const total = scripts + styles + images;

  if (total > 100) {
    return {
      id: 'resource-count',
      name: 'Resource Count',
      status: 'fail',
      score: 30,
      message: `Too many resources: ${total} external resources.`,
      details: 'Reduce HTTP requests by combining files and using sprites.',
      value: `${scripts} JS, ${styles} CSS, ${images} img`,
    };
  }

  if (total > 50) {
    return {
      id: 'resource-count',
      name: 'Resource Count',
      status: 'warning',
      score: 60,
      message: `High resource count: ${total} external resources.`,
      details: 'Consider reducing the number of external resources.',
      value: `${scripts} JS, ${styles} CSS, ${images} img`,
    };
  }

  return {
    id: 'resource-count',
    name: 'Resource Count',
    status: 'pass',
    score: 100,
    message: 'Resource count is acceptable.',
    value: `${total} total`,
  };
}

async function checkCompression(ctx: AuditContext): Promise<CheckResult> {
  const { headers } = ctx;
  const contentEncoding = headers['content-encoding'] || '';
  const transferEncoding = headers['transfer-encoding'] || '';

  if (contentEncoding.includes('gzip') || contentEncoding.includes('br') || contentEncoding.includes('deflate')) {
    return {
      id: 'compression',
      name: 'Compression',
      status: 'pass',
      score: 100,
      message: 'Content is compressed.',
      value: contentEncoding.split(',')[0],
    };
  }

  if (transferEncoding.includes('chunked')) {
    return {
      id: 'compression',
      name: 'Compression',
      status: 'warning',
      score: 70,
      message: 'Using chunked transfer but no compression.',
      details: 'Enable gzip or brotli compression for better performance.',
    };
  }

  return {
    id: 'compression',
    name: 'Compression',
    status: 'warning',
    score: 50,
    message: 'No compression detected.',
    details: 'Enable gzip or brotli compression to reduce transfer size.',
  };
}

async function checkCaching(ctx: AuditContext): Promise<CheckResult> {
  const { headers } = ctx;
  const cacheControl = headers['cache-control'] || '';
  const expires = headers['expires'] || '';
  const etag = headers['etag'] || '';
  const lastModified = headers['last-modified'] || '';

  const hasCacheHeaders = !!(cacheControl || expires);
  const hasValidators = !!(etag || lastModified);

  if (!hasCacheHeaders && !hasValidators) {
    return {
      id: 'caching',
      name: 'Browser Caching',
      status: 'warning',
      score: 50,
      message: 'No caching headers detected.',
      details: 'Add Cache-Control or Expires headers to improve repeat visit performance.',
    };
  }

  if (cacheControl.includes('no-store') || cacheControl.includes('no-cache')) {
    return {
      id: 'caching',
      name: 'Browser Caching',
      status: 'warning',
      score: 60,
      message: 'Caching is disabled.',
      details: 'Consider enabling caching for static assets.',
    };
  }

  if (hasCacheHeaders && hasValidators) {
    return {
      id: 'caching',
      name: 'Browser Caching',
      status: 'pass',
      score: 100,
      message: 'Good caching configuration.',
    };
  }

  return {
    id: 'caching',
    name: 'Browser Caching',
    status: 'pass',
    score: 85,
    message: 'Caching headers are present.',
  };
}
