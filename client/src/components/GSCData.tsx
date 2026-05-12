import { useState, useEffect } from 'react';
import { useGSC } from '../hooks/useGSC';
import type { GSCAnalyticsResult, GSCBulkIndexResult } from '../types/gsc';
import { GSCChart } from './GSCChart';

interface GSCDataProps {
  siteUrl?: string;
  onSiteSelect?: (site: string) => void;
}

export function GSCData({ siteUrl: initialSiteUrl, onSiteSelect }: GSCDataProps) {
  const { status, isLoading, analytics, getAnalytics, getFullIndexCoverage, getUrlIndexingStatus } = useGSC();
  const [selectedSite, setSelectedSite] = useState<string>(initialSiteUrl || '');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    end.setDate(end.getDate() - 3); // GSC data has 2-3 day delay
    const start = new Date(end);
    start.setDate(start.getDate() - 27); // 28 days total
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [localAnalytics, setLocalAnalytics] = useState<GSCAnalyticsResult | null>(null);
  const [indexCoverage, setIndexCoverage] = useState<GSCBulkIndexResult | null>(null);
  const [activeTab, setActiveTab] = useState<'queries' | 'pages'>('queries');
  const [indexFilter, setIndexFilter] = useState<'all' | 'indexed' | 'notIndexed'>('all');
  const [crawlTimes, setCrawlTimes] = useState<Record<string, string>>({});
  const [notIndexedReasons, setNotIndexedReasons] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status?.sites?.length && !selectedSite) {
      setSelectedSite(status.sites[0].siteUrl);
    }
  }, [status?.sites, selectedSite]);

  const handleFetchAnalytics = async () => {
    if (!selectedSite) return;
    
    try {
      // Fetch both analytics and index coverage in parallel
      const [analyticsData, coverageData] = await Promise.all([
        getAnalytics(selectedSite, dateRange.start, dateRange.end),
        getFullIndexCoverage(selectedSite),
      ]);
      setLocalAnalytics(analyticsData);
      setIndexCoverage(coverageData);
      setIndexFilter('all'); // Reset filter on new fetch
    } catch (e) {
      console.error('Failed to fetch data:', e);
    }
  };

  const displayData = analytics || localAnalytics;
  const sites = status?.sites || [];

  // Filter index coverage results based on selected filter
  const filteredIndexResults = indexCoverage?.results 
    ? indexCoverage.results.filter(item => {
        if (indexFilter === 'all') return true;
        if (indexFilter === 'indexed') return item.isIndexed;
        if (indexFilter === 'notIndexed') return !item.isIndexed;
        return true;
      })
    : [];

  // Fetch URL inspection data on demand
  const fetchUrlInspection = async (url: string, type: 'crawlTime' | 'reason') => {
    if ((type === 'crawlTime' && crawlTimes[url]) || (type === 'reason' && notIndexedReasons[url]) || !selectedSite) return;
    setLoadingUrl(url);
    try {
      const result = await getUrlIndexingStatus(url, selectedSite);
      console.log('URL Inspection result:', result);
      
      if (type === 'crawlTime') {
        // For indexed pages, store lastCrawlTime
        const value = result.lastCrawlTime || 'N/A';
        setCrawlTimes(prev => {
          const updated = { ...prev, [url]: value };
          localStorage.setItem('gsc_crawlTimes', JSON.stringify(updated));
          return updated;
        });
      } else {
        // For non-indexed pages, store the reason
        const reason = result.coverageState || result.pageFetchState || 'Unknown';
        setNotIndexedReasons(prev => {
          const updated = { ...prev, [url]: reason };
          localStorage.setItem('gsc_notIndexedReasons', JSON.stringify(updated));
          return updated;
        });
      }
    } catch (e) {
      console.error('Failed to fetch URL inspection:', e);
      const errorMsg = e instanceof Error ? e.message : '';
      const errorValue = errorMsg.includes('429') || errorMsg.includes('Quota') ? 'Quota exceeded' : 'Error';
      if (type === 'crawlTime') {
        setCrawlTimes(prev => ({ ...prev, [url]: errorValue }));
      } else {
        setNotIndexedReasons(prev => ({ ...prev, [url]: errorValue }));
      }
    } finally {
      setLoadingUrl(null);
    }
  };

  // Load cached data from localStorage on mount
  useEffect(() => {
    try {
      const cachedCrawlTimes = localStorage.getItem('gsc_crawlTimes');
      if (cachedCrawlTimes) setCrawlTimes(JSON.parse(cachedCrawlTimes));
      const cachedReasons = localStorage.getItem('gsc_notIndexedReasons');
      if (cachedReasons) setNotIndexedReasons(JSON.parse(cachedReasons));
    } catch {}
  }, []);

  // Translate coverage state to French (matching GSC dashboard)
  const translateReason = (reason: string): string => {
    const translations: Record<string, string> = {
      'Submitted URL not selected as canonical': 'URL non sélectionnée comme canonique',
      'Duplicate, Google chose different canonical': 'Doublon, Google a choisi une autre canonique',
      'Alternate page with proper canonical tag': 'Page alternative avec balise canonique',
      'Redirect error': 'Erreur de redirection',
      'Not found (404)': 'Introuvable (404)',
      'Server error (5xx)': 'Erreur serveur (5xx)',
      'Soft 404': 'Soft 404',
      'Page with redirect': 'Page avec redirection',
      'URL is not known to Google': 'URL inconnue de Google',
      'Crawl anomaly': 'Anomalie de crawl',
      'URL is not indexable': 'URL non indexable',
      'Blocked by robots.txt': 'Bloqué par robots.txt',
      'Excluded by noindex tag': 'Exclu par balise noindex',
    };
    // Check for partial matches
    for (const [key, value] of Object.entries(translations)) {
      if (reason.toLowerCase().includes(key.toLowerCase())) return value;
    }
    return reason;
  };
  if (!status?.connected) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header with site selector and date range */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Console Analytics</h3>
        
        <div className="flex flex-wrap gap-4">
          {/* Site Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                onSiteSelect?.(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a site</option>
              {sites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {site.siteUrl}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          {/* GSC Data Delay Notice */}
          <div className="flex items-end">
            <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              ⚠️ GSC data has 2-3 day delay
            </p>
          </div>

          {/* Fetch Button */}
          <div className="flex items-end">
            <button
              onClick={handleFetchAnalytics}
              disabled={isLoading || !selectedSite}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Fetch Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {displayData && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.summary.totalClicks.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Total Impressions</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.summary.totalImpressions.toLocaleString()}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Average CTR</p>
              <p className="text-2xl font-bold text-gray-900">{(displayData.summary.averageCtr * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500">Average Position</p>
              <p className="text-2xl font-bold text-gray-900">{displayData.summary.averagePosition.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Performance Chart */}
      {displayData && displayData.daily && (
        <div className="px-6 pt-6">
          <GSCChart 
            dailyData={displayData.daily}
          />
        </div>
      )}


      {/* Tabs and Table */}
      {displayData && (
        <div className="p-6 pt-0">
          {/* Tabs */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('queries')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'queries'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Top Queries ({displayData.queries.length})
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'pages'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Top Pages ({displayData.pages.length})
            </button>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {activeTab === 'queries' ? (
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Query</th>
                  ) : (
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Page</th>
                  )}
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Clicks</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Impressions</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CTR</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Position</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'queries' ? displayData.queries : displayData.pages)
                  .slice(0, 20)
                  .map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900 max-w-xs truncate">
                        {activeTab === 'queries' 
                          ? (item as { query: string }).query 
                          : (item as { page: string }).page}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {item.clicks.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {item.impressions.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {(item.ctr * 100).toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 text-right">
                        {item.position.toFixed(1)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Index Coverage Table */}
      {indexCoverage && indexCoverage.results && (
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Page Index Status</h4>
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setIndexFilter('all')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  indexFilter === 'all'
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>All ({indexCoverage.results.length})</span>
              </button>
              <button
                onClick={() => setIndexFilter('indexed')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  indexFilter === 'indexed'
                    ? 'bg-green-100 text-green-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span>Indexed ({indexCoverage.summary.indexed})</span>
              </button>
              <button
                onClick={() => setIndexFilter('notIndexed')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  indexFilter === 'notIndexed'
                    ? 'bg-red-100 text-red-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <span>Not Indexed ({indexCoverage.summary.notIndexed})</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">URL</th>
                  {indexFilter === 'indexed' && (
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Last crawled</th>
                  )}
                  {indexFilter === 'notIndexed' && (
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Reason</th>
                  )}
                  {indexFilter === 'all' && (
                    <>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Clicks</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Impressions</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Position</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredIndexResults.slice(0, 100).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900 max-w-md truncate">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary-600 hover:underline"
                      >
                        {item.url}
                      </a>
                    </td>
                    {indexFilter === 'indexed' && (
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {loadingUrl === item.url ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : crawlTimes[item.url] === 'Quota exceeded' ? (
                          <span className="text-amber-600" title="Daily API quota exceeded">Quota exceeded</span>
                        ) : crawlTimes[item.url] === 'N/A' ? (
                          <span className="text-gray-400">N/A</span>
                        ) : crawlTimes[item.url] === 'Error' ? (
                          <span className="text-red-500">Error</span>
                        ) : crawlTimes[item.url] ? (
                          new Date(crawlTimes[item.url]).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        ) : (
                          <button 
                            onClick={() => fetchUrlInspection(item.url, 'crawlTime')}
                            className="text-primary-600 hover:text-primary-700 hover:underline text-xs"
                          >
                            Check
                          </button>
                        )}
                      </td>
                    )}
                    {indexFilter === 'notIndexed' && (
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {loadingUrl === item.url ? (
                          <span className="text-gray-400">Loading...</span>
                        ) : notIndexedReasons[item.url] === 'Quota exceeded' ? (
                          <span className="text-amber-600" title="Daily API quota exceeded">Quota exceeded</span>
                        ) : notIndexedReasons[item.url] === 'Error' ? (
                          <span className="text-red-500">Error</span>
                        ) : notIndexedReasons[item.url] ? (
                          <span className="text-gray-700" title={notIndexedReasons[item.url]}>{translateReason(notIndexedReasons[item.url])}</span>
                        ) : (
                          <button 
                            onClick={() => fetchUrlInspection(item.url, 'reason')}
                            className="text-primary-600 hover:text-primary-700 hover:underline text-xs"
                          >
                            Check
                          </button>
                        )}
                      </td>
                    )}
                    {indexFilter === 'all' && (
                      <>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.isIndexed 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.isIndexed ? 'Indexed' : 'Not Indexed'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          {item.clicks?.toLocaleString() || 0}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          {item.impressions?.toLocaleString() || 0}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          {item.position?.toFixed(1) || '-'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredIndexResults.length > 100 && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Showing 100 of {filteredIndexResults.length} pages
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {!displayData && !isLoading && (
        <div className="p-12 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Select a site and date range, then click "Fetch Data" to view analytics</p>
        </div>
      )}
    </div>
  );
}
