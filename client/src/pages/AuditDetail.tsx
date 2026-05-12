import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuditDetail, type SingleAudit, type CrawlAudit } from '../hooks/useAuditDetail';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { CrawlResults } from '../components/CrawlResults';
import type { AuditResult } from '../types/audit';
import type { SFCrawlResult } from '../types/sf-result';

export function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { audit, loading, error } = useAuditDetail(id);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading audit...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Audit Not Found</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link 
          to="/audits" 
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Back to Audits
        </Link>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Audit Not Found</h2>
        <Link 
          to="/audits" 
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Back to Audits
        </Link>
      </div>
    );
  }

  const handleReset = () => {
    navigate('/');
  };

  const getHostname = () => {
    try {
      return new URL(audit.url).hostname;
    } catch {
      return audit.url;
    }
  };

  const typeLabel = audit.auditType === 'single' ? 'Single Page Audit' : 'Site Crawl';
  const typeBadgeColor = audit.auditType === 'single' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800';

  // Render based on audit type
  if (audit.auditType === 'crawl') {
    const crawlAudit = audit as CrawlAudit;
    const crawlResult: SFCrawlResult = {
      crawlId: crawlAudit.crawlId,
      url: crawlAudit.url,
      startTime: crawlAudit.startTime,
      endTime: crawlAudit.endTime,
      summary: crawlAudit.summary,
      pages: crawlAudit.pages,
      issues: crawlAudit.issues,
      scores: crawlAudit.scores,
    };

    return (
      <div>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/" className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <Link to="/audits" className="hover:text-gray-700">Audits</Link>
          <span>/</span>
          <span className="text-gray-900">{getHostname()}</span>
        </nav>

        {/* Metadata */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeBadgeColor}`}>
              {typeLabel}
            </span>
            <div className="text-sm text-gray-500">
              Crawled on {new Date(crawlAudit.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
          <Link 
            to="/audits" 
            className="text-sm text-primary-600 hover:text-primary-800"
          >
            ← Back to all audits
          </Link>
        </div>

        {/* Crawl Results */}
        <CrawlResults result={crawlResult} onReset={handleReset} />
      </div>
    );
  }

  // Single page audit
  const singleAudit = audit as SingleAudit;
  const auditResult: AuditResult = {
    url: singleAudit.url,
    timestamp: singleAudit.timestamp,
    overallScore: singleAudit.overallScore,
    categories: singleAudit.categories,
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link to="/audits" className="hover:text-gray-700">Audits</Link>
        <span>/</span>
        <span className="text-gray-900">{getHostname()}</span>
      </nav>

      {/* Metadata */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeBadgeColor}`}>
            {typeLabel}
          </span>
          <div className="text-sm text-gray-500">
            Audited on {new Date(singleAudit.createdAt).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        <Link 
          to="/audits" 
          className="text-sm text-primary-600 hover:text-primary-800"
        >
          ← Back to all audits
        </Link>
      </div>

      {/* Results */}
      <ResultsDashboard result={auditResult} onReset={handleReset} />
    </div>
  );
}
