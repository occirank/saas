import type { SFCrawlResult, SFPageData } from '../types/sf-result';
import { ScoreCircle } from './ScoreCircle';

interface CrawlResultsProps {
  result: SFCrawlResult;
  onReset?: () => void;
}

export function CrawlResults({ result, onReset }: CrawlResultsProps) {
  const { summary, scores, issues, pages } = result;

  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;

  const pagesWithoutTitle = pages.filter(p => !p.title);
  const pagesWithoutDescription = pages.filter(p => !p.metaDescription);
  const pagesWithoutH1 = pages.filter(p => !p.h1);
  const slowPages = pages.filter(p => (p.responseTime || 0) > 2000);
  const largePages = pages.filter(p => (p.pageSize || 0) > 500000);

  const formatBytes = (bytes: number) => {
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatTime = (ms: number) => {
    if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const downloadCSV = (data: SFPageData[], filename: string) => {
    const headers = [
      'URL', 'Status Code', 'Content Type', 'Title', 'Title Length', 'Title Pixel Width',
      'Meta Description', 'Desc Length', 'Desc Pixel Width', 'Meta Keywords',
      'H1', 'H1 Length', 'H1-2', 'H2-1', 'H2-2',
      'Meta Robots', 'X-Robots', 'Canonical', 'rel=next', 'rel=prev', 'AMP',
      'Size', 'Transferred', 'Words', 'Sentences', 'Avg W/S', 'Flesch', 'Readability',
      'Crawl Depth', 'Folder Depth', 'Inlinks', 'Unique In', 'Outlinks', 'Unique Out', 'Ext Out',
      'Time', 'Last Mod', 'Redirect', 'Lang', 'HTTP Ver', 'Index', 'Issues'
    ];

    const escapeCSV = (val: string | number | undefined) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = data.map(p => [
      escapeCSV(p.url),
      escapeCSV(p.statusCode),
      escapeCSV(p.contentType),
      escapeCSV(p.title),
      escapeCSV(p.titleLength),
      escapeCSV(p.titlePixelWidth),
      escapeCSV(p.metaDescription),
      escapeCSV(p.metaDescriptionLength),
      escapeCSV(p.metaDescriptionPixelWidth),
      escapeCSV(p.metaKeywords),
      escapeCSV(p.h1),
      escapeCSV(p.h1Length),
      escapeCSV(p.h1_2),
      escapeCSV(p.h2_1),
      escapeCSV(p.h2_2),
      escapeCSV(p.metaRobots),
      escapeCSV(p.xRobotsTag),
      escapeCSV(p.canonical),
      escapeCSV(p.relNext),
      escapeCSV(p.relPrev),
      escapeCSV(p.amphtmlLink),
      escapeCSV(p.pageSize ? formatBytes(p.pageSize) : ''),
      escapeCSV(p.transferred ? formatBytes(p.transferred) : ''),
      escapeCSV(p.wordCount),
      escapeCSV(p.sentenceCount),
      escapeCSV(p.avgWordsPerSentence),
      escapeCSV(p.fleschReadabilityScore),
      escapeCSV(p.readability),
      escapeCSV(p.crawlDepth),
      escapeCSV(p.folderDepth),
      escapeCSV(p.inlinks),
      escapeCSV(p.uniqueInlinks),
      escapeCSV(p.outlinks),
      escapeCSV(p.uniqueOutlinks),
      escapeCSV(p.externalOutlinks),
      escapeCSV(p.responseTime ? formatTime(p.responseTime) : ''),
      escapeCSV(p.lastModified),
      escapeCSV(p.redirectUrl),
      escapeCSV(p.language),
      escapeCSV(p.httpVersion),
      escapeCSV(p.indexability),
      escapeCSV(p.issues.length)
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {(() => { try { return new URL(result.url || '').hostname; } catch { return result.url; } })()}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {summary.crawledPages} pages crawled • {issues.length} issues found
            </p>
          </div>
          <ScoreCircle score={scores.overall} size="lg" />
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-4 text-sm text-primary-600 hover:text-primary-700"
          >
            ← Run another crawl
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Pages</p>
          <p className="text-xl font-bold text-gray-900">{summary.crawledPages}</p>
        </div>
        <div className={`rounded-lg border p-4 ${summary.brokenLinks > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-500">Broken Links</p>
          <p className={`text-xl font-bold ${summary.brokenLinks > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.brokenLinks}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Redirects</p>
          <p className="text-xl font-bold text-gray-900">{summary.redirects}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Avg Response</p>
          <p className="text-xl font-bold text-gray-900">{formatTime(summary.avgResponseTime)}</p>
        </div>
      </div>

{issues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Issues - ({issues.length})</h3>
            <div className="flex gap-4 text-sm">
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.entries(
              issues.reduce((acc, issue) => {
                const url = issue.url || 'General';
                if (!acc[url]) acc[url] = [];
                acc[url].push(issue);
                return acc;
              }, {} as Record<string, typeof issues>)
            ).map(([url, urlIssues]) => (
              <div key={url} className="border-b border-gray-100 last:border-b-0">
                <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 truncate font-mono">
                  {url}
                </div>
                {urlIssues.map((issue, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                    <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      issue.type === 'error' 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-amber-100 text-amber-600'
                    }`}>
                      {issue.type === 'error' ? '!' : 'i'}
                    </span>
                    <p className="text-sm text-gray-700">{issue.message}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

{/* Content Overview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Content Overview</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Missing Title</p>
            <p className={`text-2xl font-bold ${pagesWithoutTitle.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{pagesWithoutTitle.length}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Missing Description</p>
            <p className={`text-2xl font-bold ${pagesWithoutDescription.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pagesWithoutDescription.length}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Missing H1</p>
            <p className={`text-2xl font-bold ${pagesWithoutH1.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pagesWithoutH1.length}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Low Word Count</p>
            <p className={`text-2xl font-bold ${pages.filter(p => (p.wordCount || 0) < 300).length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pages.filter(p => (p.wordCount || 0) < 300).length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Performance</h3>
        </div>
        <div className="grid grid-cols-3 gap-4 p-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Avg Size</p>
            <p className="text-xl font-bold text-gray-900">{formatBytes(summary.avgPageSize)}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Slow Pages</p>
            <p className={`text-xl font-bold ${slowPages.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {slowPages.length}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Large Pages</p>
            <p className={`text-xl font-bold ${largePages.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {largePages.length}
            </p>
          </div>
        </div>
      </div>

      {/* PageSpeed Insights Section */}
      {result.psiScores && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">PageSpeed Insights (PSI)</h3>
            <p className="text-xs text-gray-500 mt-1">Google Lighthouse scores for {result.psiScores.pagesWithPSI} page{result.psiScores.pagesWithPSI !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Mobile Perf</p>
              <p className={`text-xl font-bold ${
                result.psiScores.avgMobilePerformance >= 90 ? 'text-green-600' :
                result.psiScores.avgMobilePerformance >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {result.psiScores.avgMobilePerformance}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Desktop Perf</p>
              <p className={`text-xl font-bold ${
                result.psiScores.avgDesktopPerformance >= 90 ? 'text-green-600' :
                result.psiScores.avgDesktopPerformance >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {result.psiScores.avgDesktopPerformance}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Overall Score</p>
              <p className={`text-xl font-bold ${
                result.psiScores.avgOverallPerformance >= 90 ? 'text-green-600' :
                result.psiScores.avgOverallPerformance >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {result.psiScores.avgOverallPerformance}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">CWV Pass Rate</p>
              <p className={`text-xl font-bold ${
                result.psiScores.coreWebVitalsPassRate >= 75 ? 'text-green-600' :
                result.psiScores.coreWebVitalsPassRate >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {result.psiScores.coreWebVitalsPassRate}%
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Pages Audited</p>
              <p className="text-xl font-bold text-gray-900">{result.psiScores.pagesWithPSI}</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-Page PSI Results Table */}
      {(() => {
        const pagesWithPSI = pages.filter(p => p.psi);
        if (pagesWithPSI.length === 0) return null;
        
        const getCWVBadge = (score: 'good' | 'needs-improvement' | 'poor') => {
          const colors = {
            'good': 'bg-green-100 text-green-700',
            'needs-improvement': 'bg-amber-100 text-amber-700',
            'poor': 'bg-red-100 text-red-700'
          };
          const labels = {
            'good': '\u2713',
            'needs-improvement': '~',
            'poor': '\u2717'
          };
          return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[score]}`}>{labels[score]}</span>;
        };

        const getScoreColor = (score: number) => {
          if (score >= 90) return 'text-green-600';
          if (score >= 50) return 'text-amber-600';
          return 'text-red-600';
        };
        
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Per-Page PSI Results ({pagesWithPSI.length})</h3>
              <p className="text-xs text-gray-500 mt-1">Mobile and Desktop Lighthouse scores with Core Web Vitals</p>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm whitespace-nowrap w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500">Mobile</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500">Desktop</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500">Overall</th>
                    <th className="text-center py-2 px-1 font-medium text-gray-500 text-xs" colSpan={3}>Mobile CWV</th>
                    <th className="text-center py-2 px-1 font-medium text-gray-500 text-xs" colSpan={3}>Desktop CWV</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">LCP</th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">INP</th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">CLS</th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">LCP</th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">INP</th>
                    <th className="text-center py-1 px-1 font-normal text-gray-400 text-xs">CLS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagesWithPSI.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-3 truncate max-w-[200px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-bold ${getScoreColor(page.psi!.mobile.performance)}`}>
                          {page.psi!.mobile.performance}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-bold ${getScoreColor(page.psi!.desktop.performance)}`}>
                          {page.psi!.desktop.performance}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-bold ${getScoreColor(page.psi!.overallScore)}`}>
                          {page.psi!.overallScore}
                        </span>
                      </td>
                      {/* Mobile CWV */}
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.mobile.coreWebVitals.lcp.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{(page.psi!.mobile.coreWebVitals.lcp.value / 1000).toFixed(1)}s</span>
                      </td>
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.mobile.coreWebVitals.inp.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{page.psi!.mobile.coreWebVitals.inp.value}ms</span>
                      </td>
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.mobile.coreWebVitals.cls.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{page.psi!.mobile.coreWebVitals.cls.value.toFixed(2)}</span>
                      </td>
                      {/* Desktop CWV */}
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.desktop.coreWebVitals.lcp.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{(page.psi!.desktop.coreWebVitals.lcp.value / 1000).toFixed(1)}s</span>
                      </td>
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.desktop.coreWebVitals.inp.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{page.psi!.desktop.coreWebVitals.inp.value}ms</span>
                      </td>
                      <td className="py-2 px-1 text-center">
                        {getCWVBadge(page.psi!.desktop.coreWebVitals.cls.score)}
                        <span className="text-xs text-gray-500 ml-0.5">{page.psi!.desktop.coreWebVitals.cls.value.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}


      {pages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">All Pages with Content Type (text/html; charset=utf-8) - ({pages.length})</h3>
            <button
              onClick={() => downloadCSV(pages, 'all-pages')}
              className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
            >
              Download CSV
            </button>
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="text-sm whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pages.map((page, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                    <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                        page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{page.statusCode}</span>
                    </td>
                    <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                    <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                    <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Short Titles section */}
      {(() => {
        const shortTitles = pages.filter(p => p.title && p.title.length <= 60);
        return shortTitles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Short Titles (≤60 chars) - ({shortTitles.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Titles that are concise and SEO-friendly</p>
              </div>
              <button
                onClick={() => downloadCSV(shortTitles, 'short-titles')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {shortTitles.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Long Titles section */}
      {(() => {
        const longTitles = pages.filter(p => p.title && p.title.length > 60);
        return longTitles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Long Titles ({'>'}60 chars) - ({longTitles.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Titles that may be truncated in search results</p>
              </div>
              <button
                onClick={() => downloadCSV(longTitles, 'long-titles')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {longTitles.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Missing Titles section */}
      {(() => {
        const missingTitles = pages.filter(p => !p.title || p.title.length === 0);
        return missingTitles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Missing Titles - ({missingTitles.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages without a title tag</p>
              </div>
              <button
                onClick={() => downloadCSV(missingTitles, 'missing-titles')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {missingTitles.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Short Meta Descriptions section */}
      {(() => {
        const shortMeta = pages.filter(p => p.metaDescription && p.metaDescription.length <= 155);
        return shortMeta.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Short Meta Descriptions (≤155 chars) - ({shortMeta.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Meta descriptions that are concise and SEO-friendly</p>
              </div>
              <button
                onClick={() => downloadCSV(shortMeta, 'short-meta-descriptions')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {shortMeta.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Long Meta Descriptions section */}
      {(() => {
        const longMeta = pages.filter(p => p.metaDescription && p.metaDescription.length > 155);
        return longMeta.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Long Meta Descriptions ({'>'}155 chars) - ({longMeta.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Meta descriptions that may be truncated in search results</p>
              </div>
              <button
                onClick={() => downloadCSV(longMeta, 'long-meta-descriptions')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {longMeta.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Missing Meta Descriptions section */}
      {(() => {
        const missingMeta = pages.filter(p => !p.metaDescription || p.metaDescription.length === 0);
        return missingMeta.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Missing Meta Descriptions - ({missingMeta.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages without a meta description tag</p>
              </div>
              <button
                onClick={() => downloadCSV(missingMeta, 'missing-meta-descriptions')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[600px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Content-Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Title Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Desc</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Len</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Desc Px</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Keywords</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">H1 Len</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H2-2</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">X-Robots</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Canonical</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=next</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">rel=prev</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">AMP</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Sentences</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Avg W/S</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Flesch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Readability</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Crawl Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Folder Depth</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Inlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique In</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Outlinks</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Unique Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Ext Out</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Time</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Last Mod</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Lang</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">HTTP Ver</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Index</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {missingMeta.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.contentType}>{page.contentType || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titlePixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.metaDescription}>{page.metaDescription || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionPixelWidth ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.metaKeywords}>{page.metaKeywords || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.h1}>{page.h1 || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.h1Length ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h1_2}>{page.h1_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_1}>{page.h2_1 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.h2_2}>{page.h2_2 || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.xRobotsTag}>{page.xRobotsTag || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[150px]" title={page.canonical}>{page.canonical || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relNext}>{page.relNext || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.relPrev}>{page.relPrev || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.amphtmlLink}>{page.amphtmlLink || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.sentenceCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.avgWordsPerSentence ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.fleschReadabilityScore ?? '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.readability}>{page.readability || '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.crawlDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.folderDepth ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.inlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueInlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.outlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.uniqueOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.externalOutlinks ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[80px]" title={page.lastModified}>{page.lastModified || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[100px]" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.language}>{page.language || '-'}</td>
                      <td className="py-2 px-3 truncate max-w-[50px]" title={page.httpVersion}>{page.httpVersion || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-xs ${page.indexability === 'Indexable' ? 'text-green-600' : 'text-yellow-600'}`}>{page.indexability || '-'}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`${page.issues.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{page.issues.length}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Missing H1 section */}
      {(() => {
        const missingH1 = pages.filter(p => !p.h1 || p.h1.length === 0);
        return missingH1.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Missing H1 Tags - ({missingH1.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages without an H1 heading tag</p>
              </div>
              <button
                onClick={() => downloadCSV(missingH1, 'missing-h1')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">H1</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
{missingH1.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate" title={page.title}>{page.title || <span className="text-red-500">-</span>}</td>
                      <td className="py-2 px-3 text-center text-red-500">-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Multiple H1 section */}
      {(() => {
const multipleH1 = pages.filter(p => p.h1_2 && p.h1_2.length > 0);
        return multipleH1.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Multiple H1 Tags - ({multipleH1.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with more than one H1 tag</p>
              </div>
              <button
                onClick={() => downloadCSV(multipleH1, 'multiple-h1')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-1</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">H1-2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {multipleH1.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.h1}>{page.h1 || '-'}</td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.h1_2}>{page.h1_2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Duplicate Titles section */}
      {(() => {
        const titleCounts = new Map<string, SFPageData[]>();
        pages.forEach(p => {
          if (p.title) {
            const existing = titleCounts.get(p.title) || [];
            existing.push(p);
            titleCounts.set(p.title, existing);
          }
        });
        const duplicateTitles = Array.from(titleCounts.entries()).filter(([_, pages]) => pages.length > 1).flatMap(([_, pages]) => pages);
        return duplicateTitles.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Duplicate Titles - ({duplicateTitles.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with non-unique title tags</p>
              </div>
              <button
                onClick={() => downloadCSV(duplicateTitles, 'duplicate-titles')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Title Len</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
{duplicateTitles.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.title}>{page.title}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.titleLength ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Duplicate Meta Descriptions section */}
      {(() => {
        const descCounts = new Map<string, SFPageData[]>();
        pages.forEach(p => {
          if (p.metaDescription) {
            const existing = descCounts.get(p.metaDescription) || [];
            existing.push(p);
            descCounts.set(p.metaDescription, existing);
          }
        });
        const duplicateDescs = Array.from(descCounts.entries()).filter(([_, pages]) => pages.length > 1).flatMap(([_, pages]) => pages);
        return duplicateDescs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Duplicate Meta Descriptions - ({duplicateDescs.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with non-unique meta descriptions</p>
              </div>
              <button
                onClick={() => downloadCSV(duplicateDescs, 'duplicate-meta-descriptions')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Description</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Desc Len</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
{duplicateDescs.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.metaDescription}>{page.metaDescription}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.metaDescriptionLength ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 4xx/5xx Error Pages section */}
      {(() => {
        const errorPages = pages.filter(p => p.statusCode >= 400);
        return errorPages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Error Pages (4xx/5xx) - ({errorPages.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages returning client or server errors</p>
              </div>
              <button
                onClick={() => downloadCSV(errorPages, 'error-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Title</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
{errorPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.title}>{page.title || '-'}</td>
                      <td className="py-2 px-3 truncate" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Redirect Pages section */}
      {(() => {
        const redirectPages = pages.filter(p => p.statusCode >= 300 && p.statusCode < 400);
        return redirectPages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Redirect Pages (3xx) - ({redirectPages.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages that redirect to another URL</p>
              </div>
              <button
                onClick={() => downloadCSV(redirectPages, 'redirect-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
<tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Redirect URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
{redirectPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.redirectType}>{page.redirectType || '-'}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.redirectUrl}>{page.redirectUrl || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Slow Pages section */}
      {(() => {
        const slowPages = pages.filter(p => (p.responseTime || 0) > 2000);
        return slowPages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Slow Pages ({'>'}2s) - ({slowPages.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with response time over 2 seconds</p>
              </div>
              <button
                onClick={() => downloadCSV(slowPages, 'slow-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Response Time</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {slowPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 text-center text-red-600 font-medium">{page.responseTime ? formatTime(page.responseTime) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Large Pages section */}
      {(() => {
        const largePages = pages.filter(p => (p.pageSize || 0) > 500000);
        return largePages.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Large Pages ({'>'}500KB) - ({largePages.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with size over 500KB</p>
              </div>
              <button
                onClick={() => downloadCSV(largePages, 'large-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm whitespace-nowrap">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-8">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Page Size</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500">Transferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {largePages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate max-w-[300px] text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 text-center text-red-600 font-medium">{page.pageSize ? formatBytes(page.pageSize) : '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-600">{page.transferred ? formatBytes(page.transferred) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Non-Indexable Pages section */}
      {(() => {
        const nonIndexable = pages.filter(p => p.indexability !== 'Indexable');
        return nonIndexable.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Non-Indexable Pages - ({nonIndexable.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages blocked from search engine indexing</p>
              </div>
              <button
                onClick={() => downloadCSV(nonIndexable, 'non-indexable-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Indexability</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Meta Robots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {nonIndexable.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          page.statusCode === 200 ? 'bg-green-100 text-green-700' :
                          page.statusCode >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.indexability}>{page.indexability || '-'}</td>
                      <td className="py-2 px-3 truncate text-gray-900" title={page.metaRobots}>{page.metaRobots || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Thin Content Pages section */}
      {(() => {
        const thinContent = pages.filter(p => (p.wordCount || 0) < 300 && p.statusCode === 200);
        return thinContent.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 mt-8">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Thin Content Pages ({'<'}300 words) - ({thinContent.length})</h3>
                <p className="text-xs text-gray-500 mt-1">Pages with low word count that may lack substantive content</p>
              </div>
              <button
                onClick={() => downloadCSV(thinContent, 'thin-content-pages')}
                className="text-xs bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors"
              >
                Download CSV
              </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
              <table className="text-sm w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 font-medium text-gray-500 w-12">#</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-500 w-2/5">URL</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Status</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Words</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-500 w-20">Sentences</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {thinContent.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="py-2 px-3 truncate text-primary-600" title={page.url}>{page.url}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{page.statusCode}</span>
                      </td>
                      <td className="py-2 px-3 text-center text-gray-900">{page.wordCount ?? '-'}</td>
                      <td className="py-2 px-3 text-center text-gray-900">{page.sentenceCount ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
