import type { AuditCheck, AuditContext, CheckResult } from '../types.js';

/**
 * Interface for heading style analysis
 */
export interface HeadingStyleInfo {
  level: number;
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  isVisible: boolean;
}

/**
 * Parse CSS style string to extract properties
 */
function parseStyle(style: string | undefined): Record<string, string> {
  if (!style) return {};
  
  const props: Record<string, string> = {};
  style.split(';').forEach(decl => {
    const [key, value] = decl.split(':').map(s => s.trim());
    if (key && value) {
      props[key.toLowerCase()] = value;
    }
  });
  
  return props;
}

/**
 * Parse font-size value to pixels
 */
function parseFontSize(value: string | undefined, parentSize: number = 16): number | undefined {
  if (!value) return undefined;
  
  const lower = value.toLowerCase().trim();
  
  // px
  if (lower.endsWith('px')) {
    return parseFloat(lower);
  }
  
  // rem
  if (lower.endsWith('rem')) {
    return parseFloat(lower) * 16;
  }
  
  // em
  if (lower.endsWith('em')) {
    return parseFloat(lower) * parentSize;
  }
  
  // pt
  if (lower.endsWith('pt')) {
    return parseFloat(lower) * 1.333;
  }
  
  // Keywords
  const keywordSizes: Record<string, number> = {
    'xx-small': 10,
    'x-small': 12,
    'small': 14,
    'medium': 16,
    'large': 18,
    'x-large': 24,
    'xx-large': 32,
    'larger': 19,
    'smaller': 13,
  };
  
  if (keywordSizes[lower]) {
    return keywordSizes[lower];
  }
  
  // Percentage
  if (lower.endsWith('%')) {
    return (parseFloat(lower) / 100) * parentSize;
  }
  
  return undefined;
}

/**
 * Extract heading style information from page
 */
export function extractHeadingStyles(ctx: AuditContext): HeadingStyleInfo[] {
  const { $ } = ctx;
  const headings: HeadingStyleInfo[] = [];
  
  $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
    const $el = $(el);
    const tagName = $el.prop('tagName')?.toLowerCase() || 'h1';
    const level = parseInt(tagName.replace('h', ''), 10);
    const text = $el.text().trim().substring(0, 50);
    
    // Check visibility (basic check)
    const style = $el.attr('style') || '';
    const className = $el.attr('class') || '';
    const isHidden = 
      style.includes('display:none') || 
      style.includes('display: none') ||
      style.includes('visibility:hidden') ||
      style.includes('visibility: hidden') ||
      className.includes('sr-only') ||
      className.includes('visually-hidden');
    
    // Parse inline styles
    const styleProps = parseStyle(style);
    
    // Default font sizes for headings
    const defaultSizes: Record<number, number> = {
      1: 32,
      2: 24,
      3: 19,
      4: 16,
      5: 14,
      6: 12,
    };
    
    const fontSize = parseFontSize(styleProps['font-size']) || defaultSizes[level];
    const fontWeight = styleProps['font-weight'] 
      ? parseInt(styleProps['font-weight']) || 400
      : 700; // Headings typically bold
    
    headings.push({
      level,
      text,
      fontSize,
      fontWeight,
      color: styleProps['color'],
      isVisible: !isHidden,
    });
  });
  
  return headings;
}

/**
 * Check heading visual hierarchy
 * H1 should be largest, then H2, H3, etc.
 */
export const checkHeadingVisualHierarchy: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const headings = extractHeadingStyles(ctx).filter(h => h.isVisible);
  
  if (headings.length === 0) {
    return {
      id: 'heading-visual-hierarchy',
      name: 'Heading Visual Hierarchy',
      status: 'fail',
      score: 0,
      message: 'No visible headings found.',
    };
  }

  const issues: string[] = [];
  let score = 100;

  // Group by level and get average sizes
  const levelSizes: Record<number, number[]> = {};
  headings.forEach(h => {
    if (!levelSizes[h.level]) levelSizes[h.level] = [];
    if (h.fontSize) levelSizes[h.level].push(h.fontSize);
  });

  const avgSizes: Record<number, number> = {};
  Object.entries(levelSizes).forEach(([level, sizes]) => {
    avgSizes[parseInt(level)] = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  });

  // Check hierarchy: H1 > H2 > H3 > H4 > H5 > H6
  const levels = Object.keys(avgSizes).map(Number).sort((a, b) => a - b);
  
  for (let i = 0; i < levels.length - 1; i++) {
    const current = levels[i];
    const next = levels[i + 1];
    
    if (avgSizes[current] <= avgSizes[next]) {
      issues.push(`H${current} (${avgSizes[current].toFixed(0)}px) not larger than H${next} (${avgSizes[next].toFixed(0)}px)`);
      score -= 15;
    }
  }

  // Check H1 is the largest
  if (avgSizes[1] && levels.length > 1) {
    const h1Size = avgSizes[1];
    for (const level of levels) {
      if (level !== 1 && avgSizes[level] > h1Size) {
        issues.push(`H${level} larger than H1 - H1 should be the largest heading`);
        score -= 10;
        break;
      }
    }
  }

  if (issues.length === 0) {
    return {
      id: 'heading-visual-hierarchy',
      name: 'Heading Visual Hierarchy',
      status: 'pass',
      score: 100,
      message: 'Heading visual hierarchy is properly ordered by size.',
      value: `H1: ${avgSizes[1]?.toFixed(0) || '-'}px`,
    };
  }

  return {
    id: 'heading-visual-hierarchy',
    name: 'Heading Visual Hierarchy',
    status: score >= 60 ? 'warning' : 'fail',
    score: Math.max(0, score),
    message: 'Heading visual hierarchy issues detected.',
    details: issues.join('\n'),
  };
};

/**
 * Check heading readability (minimum font sizes)
 */
export const checkHeadingReadability: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const headings = extractHeadingStyles(ctx).filter(h => h.isVisible);
  
  if (headings.length === 0) {
    return {
      id: 'heading-readability',
      name: 'Heading Readability',
      status: 'pass',
      score: 100,
      message: 'No headings to check.',
    };
  }

  const issues: string[] = [];
  let score = 100;

  // Minimum recommended sizes
  const minSizes: Record<number, number> = {
    1: 24,
    2: 20,
    3: 18,
    4: 16,
    5: 14,
    6: 12,
  };

  headings.forEach(h => {
    const minSize = minSizes[h.level] || 12;
    if (h.fontSize && h.fontSize < minSize) {
      issues.push(`H${h.level} "${h.text.substring(0, 20)}..." is ${h.fontSize}px (min: ${minSize}px)`);
      score -= 10;
    }
  });

  if (issues.length === 0) {
    return {
      id: 'heading-readability',
      name: 'Heading Readability',
      status: 'pass',
      score: 100,
      message: 'All headings have readable font sizes.',
    };
  }

  return {
    id: 'heading-readability',
    name: 'Heading Readability',
    status: 'warning',
    score: Math.max(0, score),
    message: 'Some headings may be too small for readability.',
    details: issues.join('\n'),
  };
};

/**
 * Check font contrast (basic check using color)
 */
export const checkHeadingContrast: AuditCheck = async (ctx: AuditContext): Promise<CheckResult> => {
  const { $ } = ctx;
  const headings = extractHeadingStyles(ctx).filter(h => h.isVisible && h.color);
  
  if (headings.length === 0) {
    return {
      id: 'heading-contrast',
      name: 'Heading Contrast',
      status: 'pass',
      score: 100,
      message: 'Heading colors use defaults (browser handles contrast).',
    };
  }

  // Basic contrast check - warn if color is light gray
  const issues: string[] = [];
  let score = 100;

  headings.forEach(h => {
    if (h.color) {
      const luminance = getLuminance(h.color);
      if (luminance > 0.8) {
        issues.push(`H${h.level} may have low contrast: ${h.color}`);
        score -= 10;
      }
    }
  });

  if (issues.length === 0) {
    return {
      id: 'heading-contrast',
      name: 'Heading Contrast',
      status: 'pass',
      score: 100,
      message: 'Heading colors appear to have sufficient contrast.',
    };
  }

  return {
    id: 'heading-contrast',
    name: 'Heading Contrast',
    status: 'warning',
    score: Math.max(0, score),
    message: 'Some headings may have insufficient color contrast.',
    details: issues.join('\n'),
  };
};

/**
 * Calculate relative luminance from color string
 */
function getLuminance(color: string): number {
  // Parse hex or rgb
  let r: number, g: number, b: number;
  
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/(\d+)/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    } else {
      return 0.5;
    }
  } else {
    return 0.5;
  }

  // Normalize to 0-1
  r /= 255;
  g /= 255;
  b /= 255;

  // Calculate luminance
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Export typography checks as array
export const typographyChecks: AuditCheck[] = [
  checkHeadingVisualHierarchy,
  checkHeadingReadability,
  checkHeadingContrast,
];
