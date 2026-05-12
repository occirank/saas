import { useState, useEffect } from 'react';
import { useGA } from '../hooks/useGA';
import type { GAAnalyticsResult } from '../types/ga';

interface GADataProps {
  propertyId?: string;
  onPropertySelect?: (property: string) => void;
}

type TabType = 'overview' | 'daily' | 'pages' | 'sources' | 'countries' | 'devices' | 'browsers' | 'realtime';

export function GAData({ propertyId: externalPropertyId, onPropertySelect }: GADataProps) {
  const { status, isLoading, error, getAnalytics, clearError } = useGA();
  const [selectedProperty, setSelectedProperty] = useState<string>(externalPropertyId || '');
  const [localAnalytics, setLocalAnalytics] = useState<GAAnalyticsResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3); // 3 days ago
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30); // 30 days ago
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  useEffect(() => {
    if (status?.properties?.length && !selectedProperty) {
      setSelectedProperty(status.properties[0].propertyId);
    }
  }, [status?.properties, selectedProperty]);

  const handleFetchAnalytics = async () => {
    if (!selectedProperty) return;
    
    try {
      const result = await getAnalytics(selectedProperty, dateRange.start, dateRange.end);
      setLocalAnalytics(result);
    } catch (e) {
      console.error('Failed to fetch GA analytics:', e);
    }
  };

  const displayData = localAnalytics;
  const properties = status?.properties || [];

  if (!status?.connected) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header with property selector and date range */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Analytics Dashboard</h3>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={clearError} className="text-red-400 hover:text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-4">
          {/* Property Selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={selectedProperty}
              onChange={(e) => {
                setSelectedProperty(e.target.value);
                onPropertySelect?.(e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Select a property</option>
              {properties.map((prop) => (
                <option key={prop.propertyId} value={prop.propertyId}>
                  {prop.propertyName}
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

          {/* Fetch Button */}
          <div className="flex items-end">
            <button
              onClick={handleFetchAnalytics}
              disabled={isLoading || !selectedProperty}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Fetch Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {displayData && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2 flex-wrap">
            {(['overview', 'daily', 'pages', 'sources', 'countries', 'devices', 'browsers', 'realtime'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content based on active tab */}
      <div className="p-6">
        {activeTab === 'overview' && displayData && <OverviewTab data={displayData} />}
        {activeTab === 'daily' && displayData && <DailyTab data={displayData} />}
        {activeTab === 'pages' && displayData && <PagesTable data={displayData} />}
        {activeTab === 'sources' && displayData && <SourcesTable data={displayData} />}
        {activeTab === 'countries' && displayData && <CountriesTable data={displayData} />}
        {activeTab === 'devices' && displayData && <DevicesTable data={displayData} />}
        {activeTab === 'browsers' && displayData && <BrowsersTable data={displayData} />}
        {activeTab === 'realtime' && displayData && <RealtimeCard data={displayData} />}
        
        {!displayData && (
          <EmptyState message="Select a property and date range, then click 'Fetch Data' to view analytics." />
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

function OverviewTab({ data }: { data: GAAnalyticsResult }) {
  const { overview } = data;
  
  const metrics = [
    { label: 'Sessions', value: overview.sessions.toLocaleString(), color: 'blue' },
    { label: 'Users', value: overview.users.toLocaleString(), color: 'green' },
    { label: 'New Users', value: overview.newUsers.toLocaleString(), color: 'purple' },
    { label: 'Pageviews', value: overview.pageviews.toLocaleString(), color: 'indigo' },
    { label: 'Bounce Rate', value: formatPercent(overview.bounceRate), color: 'orange' },
    { label: 'Avg. Duration', value: formatDuration(overview.avgSessionDuration), color: 'pink' },
    { label: 'Events/Session', value: overview.eventsPerSession.toFixed(2), color: 'teal' },
  ];

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Overview</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className={`bg-${metric.color}-50 p-4 rounded-lg`}>
            <p className="text-sm text-gray-500">{metric.label}</p>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyTab({ data }: { data: GAAnalyticsResult }) {
  if (!data.daily || data.daily.length === 0) {
    return <EmptyState message="No daily data available." />;
  }

  const maxSessions = Math.max(...data.daily.map(d => d.sessions), 1);

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Daily Sessions</h4>
      <div className="space-y-2">
        {data.daily.map((day) => (
          <div key={day.date} className="flex items-center gap-3">
            <span className="text-sm text-gray-500 w-24">{day.date}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                style={{ width: `${(day.sessions / maxSessions) * 100}%` }}
              >
                {day.sessions > 0 && (
                  <span className="text-xs text-white font-medium">{day.sessions}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PagesTable({ data }: { data: GAAnalyticsResult }) {
  if (!data.topPages || data.topPages.length === 0) {
    return <EmptyState message="No page data available." />;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Page</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Pageviews</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Unique</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Avg. Time</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {data.topPages.slice(0, 15).map((page, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900 max-w-xs truncate">
                  {page.page}
                </td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{page.pageviews.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{page.uniquePageviews.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatDuration(page.avgTimeOnPage)}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatPercent(page.bounceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourcesTable({ data }: { data: GAAnalyticsResult }) {
  if (!data.topSources || data.topSources.length === 0) {
    return <EmptyState message="No source data available." />;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Source</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Sessions</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Users</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {data.topSources.slice(0, 10).map((source, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {source.source}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{source.sessions.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{source.users.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatPercent(source.bounceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountriesTable({ data }: { data: GAAnalyticsResult }) {
  if (!data.topCountries || data.topCountries.length === 0) {
    return <EmptyState message="No country data available." />;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Countries</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Country</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Sessions</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Users</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {data.topCountries.slice(0, 10).map((country, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900 truncate max-w-[200px]">{country.country}</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{country.sessions.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{country.users.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatPercent(country.bounceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DevicesTable({ data }: { data: GAAnalyticsResult }) {
  if (!data.topDevices || data.topDevices.length === 0) {
    return <EmptyState message="No device data available." />;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Devices</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Device</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Sessions</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Users</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Bounce</th>
            </tr>
          </thead>
          <tbody>
            {data.topDevices.slice(0, 10).map((device, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900 truncate max-w-[150px]">{device.device}</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{device.sessions.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{device.users.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatPercent(device.bounceRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrowsersTable({ data }: { data: GAAnalyticsResult }) {
  if (!data.topBrowsers || data.topBrowsers.length === 0) {
    return <EmptyState message="No browser data available." />;
  }

  return (
    <div>
      <h4 className="text-lg font-semibold text-gray-900 mb-4">Browsers</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Browser</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Sessions</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Users</th>
            </tr>
          </thead>
          <tbody>
            {data.topBrowsers.slice(0, 10).map((browser, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900 truncate max-w-[150px]">{browser.browser}</td>
                <td className="py-3 px-4 text-sm text-gray-900 text-right">{browser.sessions.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm text-gray-600 text-right">{browser.users.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RealtimeCard({ data }: { data: GAAnalyticsResult }) {
  const { realtime } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">Realtime Active Users</h4>
        <p className="text-sm text-gray-500">Current active users on your site</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Users Card */}
        <div className="bg-blue-50 p-6 rounded-xl text-center">
          <p className="text-sm text-blue-600 mb-1">Active Users Right Now</p>
          <p className="text-5xl font-bold text-blue-700">
            {realtime.activeUsers}
          </p>
        </div>
        
        {/* Top Pages */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Active Pages</h5>
          {realtime.byPage.length > 0 ? (
            <div className="space-y-2">
              {realtime.byPage.slice(0, 5).map((page, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-900 truncate">{page.page}</span>
                  <span className="text-sm font-medium text-blue-600">{page.activeUsers}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active pages</p>
          )}
        </div>

        {/* Top Countries */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <h5 className="text-sm font-medium text-gray-700 mb-3">By Country</h5>
          {realtime.byCountry.length > 0 ? (
            <div className="space-y-2">
              {realtime.byCountry.slice(0, 5).map((country, i) => (
                <div key={i} className="flex items-center justify-between gap-1">
                  <span className="text-sm text-gray-900">{country.country}</span>
                  <span className="text-sm text-gray-600">{country.activeUsers}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No country data</p>
          )}
        </div>
        
        {/* Top Devices */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <h5 className="text-sm font-medium text-gray-700 mb-3">By Device</h5>
          {realtime.byDevice.length > 0 ? (
            <div className="space-y-2">
              {realtime.byDevice.map((device, i) => (
                <div key={i} className="flex items-center justify-between gap-1">
                  <span className="text-sm text-gray-900">{device.device}</span>
                  <span className="text-sm text-gray-600">{device.activeUsers}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No device data</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center text-gray-500">
      <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p>{message}</p>
    </div>
  );
}
