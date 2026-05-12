import type { CrawlJob } from '../types/crawl';

interface CrawlProgressProps {
  job: CrawlJob;
  onCancel: () => void;
}

export function CrawlProgress({ job, onCancel }: CrawlProgressProps) {
  const getStatusColor = () => {
    switch (job.status) {
      case 'running': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'cancelled': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'pending': return 'Starting crawl...';
      case 'running': return 'Crawling in progress...';
      case 'completed': return 'Crawl completed!';
      case 'failed': return 'Crawl failed';
      case 'cancelled': return 'Crawl cancelled';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {/* URL */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-1">Crawling</p>
          <p className="font-medium text-gray-900 break-all">{job.url}</p>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            {job.status === 'running' && (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {job.status === 'completed' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {job.status === 'failed' && (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{getStatusText()}</span>
          </div>
        </div>

        {/* Progress Bar */}
        {job.status === 'running' && (
          <div className="mb-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-600 transition-all duration-300"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {job.progress}% complete
            </p>
          </div>
        )}

        {/* Error Message */}
        {job.status === 'failed' && job.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{job.error}</p>
          </div>
        )}

        {/* Timing */}
        <div className="text-center text-sm text-gray-500">
          <p>Started: {new Date(job.startTime).toLocaleString()}</p>
          {job.endTime && (
            <p>Finished: {new Date(job.endTime).toLocaleString()}</p>
          )}
        </div>

        {/* Cancel Button */}
        {job.status === 'running' && (
          <div className="mt-6 text-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Cancel Crawl
            </button>
          </div>
        )}
      </div>

      {/* Info about what's happening */}
      {job.status === 'running' && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>What's happening:</strong> Screaming Frog SEO Spider is crawling your website.
            This may take several minutes depending on site size. The results will be available
            once the crawl completes.
          </p>
        </div>
      )}
    </div>
  );
}
