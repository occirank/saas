import { useGSC } from '../hooks/useGSC';

interface GSCConnectProps {
  onConnected?: () => void;
}

export function GSCConnect({ onConnected }: GSCConnectProps) {
  const { status, isLoading, error, connect, disconnect, clearError } = useGSC();

  const handleConnect = async () => {
    try {
      const { authUrl } = await connect();
      // Open OAuth in popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        'GSC OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          // Check status after popup closes
          window.location.reload();
        }
      }, 500);
    } catch (e) {
      console.error('Failed to connect:', e);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onConnected?.();
    } catch (e) {
      console.error('Failed to disconnect:', e);
    }
  };

  // Not configured - show setup instructions
  if (status && !status.configured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex gap-3">
          <svg className="w-6 h-6 text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-semibold text-yellow-800 mb-2">Google Search Console Not Configured</h3>
            <p className="text-sm text-yellow-700 mb-4">
              To enable GSC integration, add these environment variables to your server:
            </p>
            <div className="bg-yellow-100 rounded-lg p-4 font-mono text-sm text-yellow-900">
              <p>GSC_CLIENT_ID=your-google-client-id</p>
              <p>GSC_CLIENT_SECRET=your-google-client-secret</p>
              <p>GSC_REDIRECT_URI=http://localhost:3001/api/gsc/callback</p>
            </div>
            <p className="text-sm text-yellow-700 mt-4">
              You can create OAuth credentials in the{' '}
              <a 
                href="https://console.cloud.google.com/apis/credentials" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-yellow-900"
              >
                Google Cloud Console
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Connected
  if (status?.connected) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-800">Connected to Google Search Console</h3>
              <p className="text-sm text-green-600">
                {status.sites?.length || 0} sites available
              </p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
        {status.sites && status.sites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-green-200">
            <p className="text-sm font-medium text-green-700 mb-2">Available Sites:</p>
            <div className="flex flex-wrap gap-2">
              {status.sites.slice(0, 5).map((site) => (
                <span 
                  key={site.siteUrl}
                  className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                >
                  {site.siteUrl}
                </span>
              ))}
              {status.sites.length > 5 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                  +{status.sites.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected - show connect button
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
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

      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Google Search Console</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          Connect your Google Search Console account to access search analytics, sitemaps, and indexing data for your websites.
        </p>
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              <span>Connect with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
