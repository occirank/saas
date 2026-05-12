import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GAConnect } from '../components/GAConnect';
import { GAData } from '../components/GAData';
import { useGA } from '../hooks/useGA';

export function GAPage() {
  const { status, checkStatus } = useGA();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true' || error) {
      // Clean up URL params
      setSearchParams({});
      // Refresh status
      checkStatus().catch(console.error);
    }
  }, [searchParams, setSearchParams, checkStatus]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Google Analytics</h1>
        <p className="text-gray-600">View detailed analytics and insights for your websites.</p>
      </div>

      {/* Connection Status */}
      <GAConnect />

      {/* Analytics Dashboard - only show when connected */}
      {status?.connected && (
        <GAData />
      )}

      {/* Info box when not connected */}
      {!status?.connected && status?.configured && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-semibold text-blue-800 mb-2">About Google Analytics Integration</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• View real-time active users on your site</li>
                <li>• Track sessions, users, and pageviews over time</li>
                <li>• Analyze traffic sources and user demographics</li>
                <li>• Monitor device and browser breakdowns</li>
                <li>• Google Analytics 4 properties supported</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
