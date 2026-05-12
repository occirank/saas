import type { AuditCheck, AuditContext, CheckResult } from '../types.js';


export const headingsChecks: AuditCheck[] = [
  checkH1,
  checkHeadingHierarchy,
  checkHeadingsCount,
];

async function checkH1(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  const h1Elements = $('h1');
  const h1Count = h1Elements.length;

  if (h1Count === 0) {
    return {
      id: 'h1-tag',
      name: 'H1 Tag',
      status: 'fail',
      score: 0,
      message: 'No H1 tag found on the page.',
      details: 'Add exactly one H1 tag that describes the main content of the page.',
    };
  }

  if (h1Count > 1) {
    return {
      id: 'h1-tag',
      name: 'H1 Tag',
      status: 'warning',
      score: 50,
      message: `Multiple H1 tags found (${h1Count}).`,
      details: 'Best practice is to have exactly one H1 tag per page.',
      value: `${h1Count} found`,
    };
  }

  const h1Text = h1Elements.first().text().trim();
  if (h1Text.length < 10) {
    return {
      id: 'h1-tag',
      name: 'H1 Tag',
      status: 'warning',
      score: 70,
      message: 'H1 tag is very short.',
      details: 'Consider a more descriptive H1 that includes target keywords.',
      value: h1Text.substring(0, 40),
    };
  }

  return {
    id: 'h1-tag',
    name: 'H1 Tag',
    status: 'pass',
    score: 100,
    message: 'Single H1 tag found with good content.',
    value: h1Text.substring(0, 40) + (h1Text.length > 40 ? '...' : ''),
  };
}

async function checkHeadingHierarchy(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const headings: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_i, el) => {
    const tagName = $(el).prop('tagName')?.toLowerCase() || '';
    const level = parseInt(tagName.replace('h', ''), 10);
    headings.push({ level, text: $(el).text().trim().substring(0, 30) });
  });

  if (headings.length === 0) {
    return {
      id: 'heading-hierarchy',
      name: 'Heading Hierarchy',
      status: 'fail',
      score: 0,
      message: 'No heading tags found.',
      details: 'Use heading tags (H1-H6) to structure your content.',
    };
  }

  // Check for skipped levels
  const levels = headings.map(h => h.level);
  let hierarchyIssues = false;
  let prevLevel = 0;
  
  for (const level of levels) {
    if (level > prevLevel + 1 && prevLevel !== 0) {
      hierarchyIssues = true;
      break;
    }
    prevLevel = level;
  }

  if (hierarchyIssues) {
    return {
      id: 'heading-hierarchy',
      name: 'Heading Hierarchy',
      status: 'warning',
      score: 60,
      message: 'Heading levels are skipped.',
      details: 'Maintain a logical hierarchy (H1 → H2 → H3) without skipping levels.',
      value: `H${levels.join(', H')}`,
    };
  }

  return {
    id: 'heading-hierarchy',
    name: 'Heading Hierarchy',
    status: 'pass',
    score: 100,
    message: 'Heading hierarchy is properly structured.',
    value: `${headings.length} headings`,
  };
}

async function checkHeadingsCount(ctx: AuditContext): Promise<CheckResult> {
  const { $ } = ctx;
  
  const counts = {
    h1: $('h1').length,
    h2: $('h2').length,
    h3: $('h3').length,
    h4: $('h4').length,
    h5: $('h5').length,
    h6: $('h6').length,
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return {
      id: 'headings-count',
      name: 'Content Structure',
      status: 'fail',
      score: 0,
      message: 'No heading tags found.',
      details: 'Use headings to structure content for both users and search engines.',
    };
  }

  if (counts.h2 === 0) {
    return {
      id: 'headings-count',
      name: 'Content Structure',
      status: 'warning',
      score: 60,
      message: 'No H2 tags found.',
      details: 'Use H2 tags to divide content into sections.',
    };
  }

  return {
    id: 'headings-count',
    name: 'Content Structure',
    status: 'pass',
    score: 100,
    message: `Good heading structure with ${total} total headings.`,
    value: `H1:${counts.h1} H2:${counts.h2} H3:${counts.h3}`,
  };
}
