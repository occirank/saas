import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

export const metaTagsChecks: AuditCheck[] = [
  checkTitleTag,
  checkMetaDescription,
  checkCanonicalUrl,
  checkOgTags,
  checkTwitterCards,
  checkRobotsMeta,
  checkViewport,
  checkCharset,
];

async function checkTitleTag(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const title = $('title').text().trim();
  const length = title.length;

  if (!title) {
    return {
      id: 'title-tag',
      name: 'Title Tag',
      status: 'fail',
      score: 0,
      message: 'Missing title tag. This is critical for SEO.',
      details: 'Add a descriptive <title> tag to your page.',
    };
  }

  if (length < 30) {
    return {
      id: 'title-tag',
      name: 'Title Tag',
      status: 'warning',
      score: 60,
      message: `Title tag is too short (${length} characters).`,
      details: 'Aim for 50-60 characters for optimal display in search results.',
      value: `${length} chars`,
    };
  }

  if (length > 60) {
    return {
      id: 'title-tag',
      name: 'Title Tag',
      status: 'warning',
      score: 70,
      message: `Title tag is too long (${length} characters).`,
      details: 'Title may be truncated in search results. Aim for 50-60 characters.',
      value: `${length} chars`,
    };
  }

  return {
    id: 'title-tag',
    name: 'Title Tag',
    status: 'pass',
    score: 100,
    message: `Title tag is present and well-optimized (${length} characters).`,
    value: `${length} chars`,
  };
}

async function checkMetaDescription(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const length = description.length;

  if (!description) {
    return {
      id: 'meta-description',
      name: 'Meta Description',
      status: 'fail',
      score: 0,
      message: 'Missing meta description.',
      details: 'Add a meta description to improve click-through rates in search results.',
    };
  }

  if (length < 120) {
    return {
      id: 'meta-description',
      name: 'Meta Description',
      status: 'warning',
      score: 60,
      message: `Meta description is too short (${length} characters).`,
      details: 'Aim for 150-160 characters for optimal display.',
      value: `${length} chars`,
    };
  }

  if (length > 160) {
    return {
      id: 'meta-description',
      name: 'Meta Description',
      status: 'warning',
      score: 70,
      message: `Meta description is too long (${length} characters).`,
      details: 'Description may be truncated. Aim for 150-160 characters.',
      value: `${length} chars`,
    };
  }

  return {
    id: 'meta-description',
    name: 'Meta Description',
    status: 'pass',
    score: 100,
    message: `Meta description is well-optimized (${length} characters).`,
    value: `${length} chars`,
  };
}

async function checkCanonicalUrl(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const canonical = $('link[rel="canonical"]').attr('href');

  if (!canonical) {
    return {
      id: 'canonical-url',
      name: 'Canonical URL',
      status: 'warning',
      score: 50,
      message: 'No canonical URL specified.',
      details: 'Add a canonical link to prevent duplicate content issues.',
    };
  }

  return {
    id: 'canonical-url',
    name: 'Canonical URL',
    status: 'pass',
    score: 100,
    message: 'Canonical URL is properly set.',
    value: canonical.length > 40 ? canonical.substring(0, 40) + '...' : canonical,
  };
}

async function checkOgTags(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDescription = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');

  const missing: string[] = [];
  if (!ogTitle) missing.push('og:title');
  if (!ogDescription) missing.push('og:description');
  if (!ogImage) missing.push('og:image');

  if (missing.length === 3) {
    return {
      id: 'og-tags',
      name: 'Open Graph Tags',
      status: 'fail',
      score: 0,
      message: 'No Open Graph tags found.',
      details: 'Add OG tags for better social media sharing previews.',
    };
  }

  if (missing.length > 0) {
    return {
      id: 'og-tags',
      name: 'Open Graph Tags',
      status: 'warning',
      score: 60,
      message: `Missing: ${missing.join(', ')}`,
      details: 'Complete OG tags for optimal social sharing.',
    };
  }

  return {
    id: 'og-tags',
    name: 'Open Graph Tags',
    status: 'pass',
    score: 100,
    message: 'All essential Open Graph tags are present.',
  };
}

async function checkTwitterCards(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const twitterCard = $('meta[name="twitter:card"]').attr('content');
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  const twitterDescription = $('meta[name="twitter:description"]').attr('content');

  if (!twitterCard && !twitterTitle && !twitterDescription) {
    return {
      id: 'twitter-cards',
      name: 'Twitter Cards',
      status: 'warning',
      score: 50,
      message: 'No Twitter Card tags found.',
      details: 'Add Twitter Card tags for better Twitter sharing previews.',
    };
  }

  if (!twitterCard) {
    return {
      id: 'twitter-cards',
      name: 'Twitter Cards',
      status: 'warning',
      score: 70,
      message: 'Twitter card type is missing.',
      details: 'Add twitter:card meta tag (summary, summary_large_image, etc.)',
    };
  }

  return {
    id: 'twitter-cards',
    name: 'Twitter Cards',
    status: 'pass',
    score: 100,
    message: 'Twitter Card tags are properly configured.',
    value: twitterCard,
  };
}

async function checkRobotsMeta(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const robots = $('meta[name="robots"]').attr('content');

  if (!robots) {
    return {
      id: 'robots-meta',
      name: 'Robots Meta Tag',
      status: 'pass',
      score: 100,
      message: 'No robots meta tag (defaults to index, follow).',
    };
  }

  if (robots.includes('noindex') || robots.includes('none')) {
    return {
      id: 'robots-meta',
      name: 'Robots Meta Tag',
      status: 'warning',
      score: 30,
      message: 'Page is set to noindex.',
      details: 'This page will not be indexed by search engines.',
      value: robots,
    };
  }

  return {
    id: 'robots-meta',
    name: 'Robots Meta Tag',
    status: 'pass',
    score: 100,
    message: 'Robots meta tag is properly configured.',
    value: robots,
  };
}

async function checkViewport(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const viewport = $('meta[name="viewport"]').attr('content');

  if (!viewport) {
    return {
      id: 'viewport',
      name: 'Viewport Meta Tag',
      status: 'fail',
      score: 0,
      message: 'Missing viewport meta tag.',
      details: 'Add viewport meta tag for mobile responsiveness.',
    };
  }

  const hasWidth = viewport.includes('width=device-width');

  if (!hasWidth) {
    return {
      id: 'viewport',
      name: 'Viewport Meta Tag',
      status: 'warning',
      score: 50,
      message: 'Viewport tag missing width=device-width.',
      value: viewport,
    };
  }

  return {
    id: 'viewport',
    name: 'Viewport Meta Tag',
    status: 'pass',
    score: 100,
    message: 'Viewport meta tag is properly configured.',
    value: 'device-width',
  };
}

async function checkCharset(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const charset = $('meta[charset]').attr('charset') || 
                  $('meta[http-equiv="Content-Type"]').attr('content');

  if (!charset) {
    return {
      id: 'charset',
      name: 'Character Encoding',
      status: 'warning',
      score: 70,
      message: 'No charset declaration found.',
      details: 'Add charset meta tag (recommend UTF-8).',
    };
  }

  if (charset.toLowerCase().includes('utf-8')) {
    return {
      id: 'charset',
      name: 'Character Encoding',
      status: 'pass',
      score: 100,
      message: 'Character encoding is set to UTF-8.',
      value: 'UTF-8',
    };
  }

  return {
    id: 'charset',
    name: 'Character Encoding',
    status: 'warning',
    score: 80,
    message: 'Charset is set but not UTF-8.',
    value: charset,
  };
}
