import { extractOnPageIssues } from '../sheets/sheets-service.js';
import { AUDIT_QUESTIONS } from '../sheets/sheets-service.js';

describe('Issue Matching Test', () => {
  // Test data - simulate crawl results
  const crawlResult = {
    pages: [
      {
        url: 'https://example.com/page1',
        title: 'Page 1 Title',
        titleLength: 15,
        metaDescription: 'A short desc',
        metaDescriptionLength: 20,
        h1: 'H1 Text',
        h1Length: 10,
        statusCode: 200,
        contentType: 'text/html',
        wordCount: 100,
      },
      {
        url: 'https://example.com/404-page',
        title: '',
        metaDescription: '',
        h1: '',
        statusCode: 404,
        contentType: 'text/html',
        wordCount: 0,
      }
    ]
  };

  const siteUrl = 'https://example.com';

  // Extract issues
  const issues = extractOnPageIssues(crawlResult, siteUrl);

  console.log('Extracted issues:', issues.length);
  console.log('Issue types:', issues.map(i => i.issueType));

  // Test matching against Q50 (404 check)
  const q50 = AUDIT_QUESTIONS.find((q: any) => q.id === 'Q50');
  console.log('Q50 matchers:', q50.issueMatchers);

  // Check if any issues match Q50
  const matchingIssues = issues.filter((issue: any) => 
    q50.issueMatchers.some((matcher: string) => 
      issue.issueType.toLowerCase().includes(matcher.toLowerCase())
    )
  );

  console.log('Matching issues for Q50:', matchingIssues.length);
  console.log('Match issue types:', matchingIssues.map(i => i.issueType));
});
