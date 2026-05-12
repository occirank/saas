import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { CrawlForm } from './components/CrawlForm';
import { CrawlProgress } from './components/CrawlProgress';
import { CrawlResults } from './components/CrawlResults';
import { useCrawl } from './hooks/useCrawl';
import { useGSC } from './hooks/useGSC';
import { AuditsList } from './pages/AuditsList';
import { AuditDetail } from './pages/AuditDetail';
import { GSCPage } from './pages/GSCPage';
import { GAPage } from './pages/GAPage';
import { KeywordsPage } from './pages/KeywordsPage';
import type { CrawlJob } from './types/crawl';
import type { SFCrawlResult } from './types/sf-result';

type CrawlScreenState = 'idle' | 'running' | 'completed' | 'error';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/audits" element={<AuditsList />} />
          <Route path="/audits/:id" element={<AuditDetail />} />
          <Route path="/gsc" element={<GSCPage />} />
          <Route path="/analytics" element={<GAPage />} />
          <Route path="/keywords" element={<KeywordsPage />} />
          <Route path="/keywords/:projectId" element={<KeywordsPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">OcciRank</h1>
              <p className="text-sm text-gray-500">Technical SEO Audit Tool</p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <Link to="/gsc" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              GSC
            </Link>
            <Link to="/analytics" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,2L2,7l10,5l10-5L12,2z M2,17l10,5l10-5 M2,12l10,5l10-5"/>
              </svg>
              Analytics
            </Link>
            <Link to="/audits" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Audit History
            </Link>
            <Link to="/keywords" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              Keywords
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Audit
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-gray-500 text-sm">
        OcciRank - Technical SEO Audit Tool
      </div>
    </footer>
  );
}

function HomePage() {
  const [crawlState, setCrawlState] = useState<CrawlScreenState>('idle');
  const [crawlJob, setCrawlJob] = useState<CrawlJob | null>(null);
  const [crawlResults, setCrawlResults] = useState<SFCrawlResult | null>(null);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [sfAvailable, setSfAvailable] = useState<boolean | null>(null);
  const crawl = useCrawl();
  const { status: gscStatus, checkStatus: checkGSCStatus } = useGSC();

  // Refresh GSC status when popup closes
  const handleGSCConnect = useCallback(() => {
    checkGSCStatus().catch(() => {});
  }, [checkGSCStatus]);

  useEffect(() => {
    crawl.checkStatus().then(s => setSfAvailable(s.screamingFrog.available));
  }, [crawl]);

  useEffect(() => {
    if (crawlState !== 'running' || !crawlJob) return;
    const interval = setInterval(async () => {
      try {
        const s = await crawl.getCrawlStatus(crawlJob.id);
        setCrawlJob(s);
        if (s.status === 'completed') {
          setCrawlState('completed');
          setCrawlResults(await crawl.getCrawlResults(crawlJob.id));
        } else if (s.status === 'failed') {
          setCrawlState('error');
          setCrawlError(s.error || 'Crawl failed');
        } else if (s.status === 'cancelled') {
          setCrawlState('idle');
          setCrawlJob(null);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [crawlState, crawlJob, crawl]);

  const handleStartCrawl = useCallback(async (url: string, opts: { maxPages?: number; maxDepth?: number; includeGsc?: boolean }) => {
    setCrawlError(null);
    setCrawlResults(null);
    try {
      const job = await crawl.startCrawl(url, opts);
      setCrawlJob(job);
      setCrawlState('running');
    } catch (e) {
      setCrawlState('error');
      setCrawlError(e instanceof Error ? e.message : 'Failed');
    }
  }, [crawl]);

  const handleCancelCrawl = useCallback(async () => {
    if (!crawlJob) return;
    try { await crawl.cancelCrawl(crawlJob.id); setCrawlState('idle'); setCrawlJob(null); } catch (e) { console.error(e); }
  }, [crawl, crawlJob]);

  const resetCrawl = useCallback(() => {
    setCrawlState('idle'); setCrawlJob(null); setCrawlResults(null); setCrawlError(null);
  }, []);

  return (
    <div className="text-center">
      <h2 className="text-4xl font-bold text-gray-900 mb-4">Crawl Your Entire Website</h2>
      <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">Powered by Screaming Frog SEO Spider.</p>
      
      {sfAvailable === false && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm max-w-md mx-auto">
          ⚠️ Screaming Frog is not available. Crawls will not work.
        </div>
      )}
      
      {sfAvailable === true && (
        <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm max-w-md mx-auto">
          ✓ Screaming Frog connected and ready
        </div>
      )}

      {crawlState === 'idle' && !crawlJob && (
        <CrawlForm onSubmit={handleStartCrawl} isLoading={false} gscStatus={gscStatus} onGSCConnect={handleGSCConnect} />
      )}

      {crawlJob && (crawlState === 'running' || crawlState === 'idle') && (
        <div className="py-8">
          <CrawlProgress job={crawlJob} onCancel={handleCancelCrawl} />
        </div>
      )}

      {crawlState === 'error' && (
        <div className="py-16">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Crawl Failed</h2>
          <p className="text-gray-500 mb-6">{crawlError}</p>
          <button onClick={resetCrawl} className="px-6 py-3 bg-primary-600 text-white rounded-lg">Try Again</button>
        </div>
      )}

      {crawlState === 'completed' && crawlResults && (
        <CrawlResults result={crawlResults} onReset={resetCrawl} />
      )}
    </div>
  );
}

export default App;
