import { useState } from 'react';
import { useGSC } from '../hooks/useGSC';

interface IndexStats {
  siteUrl: string;
  submitted: number;
  indexed: number;
  notIndexed: number;
  coverage: number;
  sitemaps: { path: string; submitted: number; indexed: number }[];
}

export function GSCIndexCoverage() {
  const { status, getIndexStats } = useGSC() as any;
  const [selectedSite, setSelectedSite] = useState('');
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!selectedSite) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getIndexStats(selectedSite);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!status?.connected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <p className="text-yellow-700">Connect to Google Search Console first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">Page Indexation</h3>
      <p className="text-sm text-gray-500 mb-4">
        Index stats from sitemaps (matches GSC dashboard).
      </p>

      <div className="flex gap-4 mb-6">
        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg"
        >
          <option value="">Select site</option>
          {(status.sites || []).map((s: any) => (
            <option key={s.siteUrl} value={s.siteUrl}>{s.siteUrl}</option>
          ))}
        </select>
        <button
          onClick={handleFetch}
          disabled={loading || !selectedSite}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:bg-gray-300"
        >
          {loading ? 'Loading...' : 'Fetch'}
        </button>
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Submitted</p>
              <p className="text-2xl font-bold">{stats.submitted}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Indexed</p>
              <p className="text-2xl font-bold text-green-600">{stats.indexed}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Not Indexed</p>
              <p className="text-2xl font-bold text-red-600">{stats.notIndexed}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Coverage</p>
              <p className="text-2xl font-bold">{stats.coverage}%</p>
            </div>
          </div>

          {stats.sitemaps.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">By Sitemap</h4>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Sitemap</th>
                      <th className="text-right p-2">Submitted</th>
                      <th className="text-right p-2">Indexed</th>
                      <th className="text-right p-2">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sitemaps.map((s, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 truncate max-w-xs">{s.path}</td>
                        <td className="p-2 text-right">{s.submitted}</td>
                        <td className="p-2 text-right text-green-600">{s.indexed}</td>
                        <td className="p-2 text-right">{s.submitted > 0 ? Math.round((s.indexed / s.submitted) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
