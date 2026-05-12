import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface AuditListItem {
  id: string;
  url: string;
  overallScore: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  auditType: 'single' | 'crawl';
  startTime: string;
  endTime: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const typeColors: Record<string, string> = {
  single: 'bg-purple-100 text-purple-800',
  crawl: 'bg-orange-100 text-orange-800',
};

const typeLabels: Record<string, string> = {
  single: 'Page',
  crawl: 'Site',
};


function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditsList() {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<AuditListItem[]>('/api/audits');
      setAudits(response.data);
    } catch (e) {
      setError(axios.isAxiosError(e) ? e.response?.data?.error || e.message : 'Failed to fetch audits');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAudit = useCallback(async (id: string) => {
    try {
      await axios.delete(`/api/audits/${id}`);
      setAudits(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
    }
  }, []);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  if (loading) {
    return <div className="text-center py-16"><div className="animate-spin w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" /><p className="text-gray-500">Loading...</p></div>;
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Audits</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <p className="text-sm text-gray-400">Make sure PostgreSQL is running.</p>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Audits Yet</h2>
        <p className="text-gray-500 mb-6">Run your first audit to see results here.</p>
        <Link to="/" className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg">Run New Audit</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit History</h1>
          <p className="text-gray-500 mt-1">{audits.length} audit{audits.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          + New Audit
        </Link>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audits.map((audit, index) => (
                <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <Link 
                      to={`/audits/${audit.id}`} 
                      className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
                      title={audit.url}
                    >
                      {audit.url.length > 40 ? audit.url.slice(0, 40) + '...' : audit.url}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[audit.auditType] || 'bg-gray-100 text-gray-800'}`}>
                      {typeLabels[audit.auditType] || audit.auditType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[audit.status] || 'bg-gray-100 text-gray-800'}`}>
                      {audit.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      audit.overallScore >= 80 ? 'bg-green-100 text-green-800' : 
                      audit.overallScore >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {audit.overallScore}/100
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(audit.endTime)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTime(audit.startTime)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatTime(audit.endTime)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        to={`/audits/${audit.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 transition-colors"
                        title="View Details"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this audit?')) {
                            deleteAudit(audit.id);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                        title="Delete Audit"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
