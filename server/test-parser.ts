import { parseSFCrawlOutput } from './src/parsers/sf-parser.js';
import { extractOnPageIssues, generateAuditChecklist } from './src/sheets/sheets-service.js';

async function test() {
  const result = await parseSFCrawlOutput('../crawls/crawl_aHR0cHM6_mmf1pu0e');
  
  console.log('=== PARSED DATA ===');
  console.log('Pages:', result.pages.length);
  
  if (result.pages.length > 0) {
    const p = result.pages[0];
    console.log('\nFirst page URL:', p.url);
    console.log('contentType:', p.contentType);
    console.log('statusCode:', p.statusCode);
    console.log('title:', p.title);
    console.log('titleLength:', p.titleLength);
    console.log('titlePixelWidth:', p.titlePixelWidth);
    console.log('h1:', p.h1);
    console.log('h1Length:', p.h1Length);
    console.log('wordCount:', p.wordCount);
    console.log('inlinks:', p.inlinks);
    console.log('crawlDepth:', p.crawlDepth);
    console.log('pageSize:', p.pageSize);
    console.log('metaDescription:', p.metaDescription);
    console.log('metaDescriptionLength:', p.metaDescriptionLength);
    console.log('issues:', p.issues);
    console.log('hasStructuredData:', p.hasStructuredData);
  }
  
  // Extract issues
  const issues = extractOnPageIssues(result, 'https://www.rachatdevoiture.com/');
  console.log('\n=== EXTRACTED ISSUES ===');
  console.log('Total issues:', issues.length);
  
  if (issues.length > 0) {
    console.log('\nFirst 10 issues:');
    issues.slice(0, 10).forEach(i => console.log('  -', i.issueType, '|', i.url));
  }
  
  // Generate checklist
  const checklist = generateAuditChecklist(issues);
  console.log('\n=== CHECKLIST ===');
  console.log('Questions:', checklist.length);
  const passed = checklist.filter(c => c.statut === 'R\u00e9ussi').length;
  const failed = checklist.filter(c => c.statut === '\u00c9chou\u00e9').length;
  console.log('Passed:', passed, 'Failed:', failed);
  
  console.log('\nFirst 20 questions:');
  checklist.slice(0, 20).forEach(c => {
    const q = c.question.substring(0, 50);
    console.log('  Q' + c.numero + ':', c.statut, '-', q + '...');
  });
}

test().catch(console.error);
