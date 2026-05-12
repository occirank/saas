import type { AuditCheck, AuditContext, CheckResult } from '../types.js';


export const imagesChecks: AuditCheck[] = [
  checkAltText,
  checkImageOptimization,
  checkLazyLoading,
];

async function checkAltText(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const images = $('img');
  const total = images.length;

  if (total === 0) {
    return {
      id: 'images-alt',
      name: 'Image Alt Text',
      status: 'pass',
      score: 100,
      message: 'No images found on the page.',
    };
  }

  let missingAlt = 0;
  let emptyAlt = 0;

  images.each((_i, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined) {
      missingAlt++;
    } else if (alt.trim() === '') {
      emptyAlt++;
    }
  });

  const issues = missingAlt + emptyAlt;
  const score = Math.round(((total - issues) / total) * 100);

  if (missingAlt === total) {
    return {
      id: 'images-alt',
      name: 'Image Alt Text',
      status: 'fail',
      score: 0,
      message: 'None of the images have alt text.',
      details: 'Add descriptive alt attributes to all images for accessibility and SEO.',
      value: `${total} images`,
    };
  }

  if (issues > 0) {
    return {
      id: 'images-alt',
      name: 'Image Alt Text',
      status: 'warning',
      score,
      message: `${issues} of ${total} images missing alt text.`,
      details: 'Add descriptive alt text to improve accessibility and SEO.',
      value: `${total - issues}/${total} OK`,
    };
  }

  return {
    id: 'images-alt',
    name: 'Image Alt Text',
    status: 'pass',
    score: 100,
    message: 'All images have alt text.',
    value: `${total} images`,
  };
}

async function checkImageOptimization(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const images = $('img');
  const total = images.length;

  if (total === 0) {
    return {
      id: 'image-optimization',
      name: 'Image Optimization',
      status: 'pass',
      score: 100,
      message: 'No images to optimize.',
    };
  }

  // Check for modern image formats and size hints
  let hasModernFormats = 0;
  let hasWidthHeight = 0;

  images.each((_i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('.webp') || src.includes('.avif')) {
      hasModernFormats++;
    }
    if ($(el).attr('width') && $(el).attr('height')) {
      hasWidthHeight++;
    }
  });

  const issues = [];
  if (hasModernFormats === 0 && total > 2) {
    issues.push('Consider WebP/AVIF formats');
  }
  if (hasWidthHeight < total / 2) {
    issues.push('Add width/height attributes');
  }

  if (issues.length > 0) {
    return {
      id: 'image-optimization',
      name: 'Image Optimization',
      status: 'warning',
      score: 70,
      message: 'Image optimization can be improved.',
      details: issues.join('. '),
    };
  }

  return {
    id: 'image-optimization',
    name: 'Image Optimization',
    status: 'pass',
    score: 100,
    message: 'Images appear well-optimized.',
  };
}

async function checkLazyLoading(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const images = $('img');
  const total = images.length;

  if (total < 3) {
    return {
      id: 'lazy-loading',
      name: 'Lazy Loading',
      status: 'pass',
      score: 100,
      message: 'Few images - lazy loading not critical.',
    };
  }

  let hasLazyLoading = 0;
  images.each((_i, el) => {
    const loading = $(el).attr('loading');
    if (loading === 'lazy') {
      hasLazyLoading++;
    }
  });

  const lazyPercent = (hasLazyLoading / total) * 100;

  if (lazyPercent < 30) {
    return {
      id: 'lazy-loading',
      name: 'Lazy Loading',
      status: 'warning',
      score: 60,
      message: 'Most images lack lazy loading.',
      details: 'Add loading="lazy" to offscreen images to improve page load performance.',
      value: `${Math.round(lazyPercent)}% lazy`,
    };
  }

  return {
    id: 'lazy-loading',
    name: 'Lazy Loading',
    status: 'pass',
    score: 100,
    message: 'Images use lazy loading appropriately.',
    value: `${hasLazyLoading}/${total}`,
  };
}
