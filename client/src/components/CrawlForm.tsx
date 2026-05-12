import React, { useState } from 'react';
import type { GSCConnectionStatus } from '../types/gsc';

interface CrawlFormProps {
  onSubmit: (url: string, options: { maxPages?: number; maxDepth?: number; includeGsc?: boolean }) => void;
  isLoading: boolean;
  gscStatus?: GSCConnectionStatus | null;
  onGSCConnect?: () => void;
}

export function CrawlForm({ onSubmit, isLoading, gscStatus, onGSCConnect }: CrawlFormProps) {
  const [url, setUrl] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [maxPages, setMaxPages] = useState<number | undefined>(500);
  const [maxDepth, setMaxDepth] = useState<number | undefined>(10);
  const [includeGsc, setIncludeGsc] = useState<boolean>(true);
  const [isConnectingGSC, setIsConnectingGSC] = useState(false);

  const gscConnected = gscStatus?.connected ?? false;
  const gscConfigured = gscStatus?.configured ?? false;

  const handleConnectGSC = async () => {
    if (!gscConfigured) {
      // Not configured - show message
      alert('GSC is not configured. Please set GSC_CLIENT_ID and GSC_CLIENT_SECRET environment variables.');
      return;
    }

    setIsConnectingGSC(true);
    try {
      // Get auth URL
      const response = await fetch('/api/gsc/auth');
      const data = await response.json();
      
      if (data.authUrl) {
        // Open OAuth in popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'GSC Connect',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for popup closure
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            setIsConnectingGSC(false);
            // Notify parent to refresh GSC status
            onGSCConnect?.();
          }
        }, 500);
      }
    } catch (error) {
      console.error('Failed to connect GSC:', error);
      setIsConnectingGSC(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      let finalUrl = url.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      onSubmit(finalUrl, { maxPages, maxDepth, includeGsc });
    }
  };

  // Check if site URL matches any GSC site
  const getMatchingSite = () => {
    if (!gscStatus?.sites || !url.trim()) return null;
    
    let hostname = url.trim();
    try {
      hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    } catch {
      return null;
    }

    return gscStatus.sites.find(site => {
      const siteHost = site.siteUrl
        .replace('sc-domain:', '')
        .replace('https://', '')
        .replace('http://', '')
        .replace(/\/$/, '');
      return siteHost === hostname;
    });
  };

  const matchingSite = getMatchingSite();

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 010-18 9 9 0 010 18z" />
              </svg>
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter website to crawl (e.g., example.com)"
              className="w-full pl-12 pr-4 py-4 text-lg border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <span>Start Crawl</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>

        {/* GSC Status Banner */}
        {includeGsc && (
          <div className="mb-4">
            {gscConnected ? (
              matchingSite ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-green-700 font-medium">
                      GSC connected - this site is verified
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-blue-700">
                      GSC connected but this site may not be in your GSC properties. GSC data may be limited.
                    </span>
                  </div>
                </div>
              )
            ) : gscConfigured ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">GSC Not Connected</p>
                      <p className="text-xs text-yellow-600">
                        Connect to include GSC analysis (Q55-Q70) in your audit
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnectGSC}
                    disabled={isConnectingGSC}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                  >
                    {isConnectingGSC ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                        </svg>
                        <span>Connect GSC</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">
                    GSC not configured on server. Set <code className="bg-gray-100 px-1 rounded">GSC_CLIENT_ID</code> and <code className="bg-gray-100 px-1 rounded">GSC_CLIENT_SECRET</code> to enable.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Advanced Options
        </button>

        {showOptions && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Pages</label>
              <input
                type="number"
                value={maxPages || ''}
                onChange={(e) => setMaxPages(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="500"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Maximum pages to crawl (requires SF license for &gt;500)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Depth</label>
              <input
                type="number"
                value={maxDepth || ''}
                onChange={(e) => setMaxDepth(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                placeholder="10"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">Crawl depth from homepage</p>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGsc}
                  onChange={(e) => setIncludeGsc(e.target.checked)}
                  className="w-4 h-4 text-primary-600 focus:ring-2 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Include GSC Analysis</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Fetch Google Search Console issues (Q55-Q70) - {gscConnected ? '✓ Connected' : '⚠ Requires connection'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Note about Screaming Frog */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-700">
            <strong>Full Site Crawl</strong> uses Screaming Frog SEO Spider CLI. 
            Make sure it's installed at <code className="bg-blue-100 px-1 rounded">C:\Program Files\Screaming Frog SEO Spider\</code>
          </div>
        </div>
      </div>
    </form>
  );
}
