import type { KeywordWithRanking } from '../types/keywords';

interface KeywordsTableProps {
  keywords: KeywordWithRanking[];
  isLoading: boolean;
  onCheck: (id: string) => void;
  onDelete: (id: string) => void;
  onRowClick: (keyword: KeywordWithRanking) => void;
}

function getPositionColor(position: number | null | undefined): string {
  if (!position) return 'bg-gray-100 text-gray-800';
  if (position <= 3) return 'bg-green-100 text-green-800';
  if (position <= 10) return 'bg-blue-100 text-blue-800';
  if (position <= 20) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function getChangeIndicator(change: number | null | undefined): string {
  if (!change) return '-';
  if (change > 0) return `+${change}`;
  return `${change}`;
}

export function KeywordsTable({ keywords, isLoading, onCheck, onDelete, onRowClick }: KeywordsTableProps) {
  console.log('[KeywordsTable] Rendering with keywords:', keywords.map(k => ({ id: k.id, keyword: k.keyword, position: k.latestRanking?.position, lastCheckedAt: k.lastCheckedAt })));
  
  if (keywords.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No keywords tracked yet. Add your first keyword to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Checked</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {keywords.map((kw) => (
              <tr 
                key={kw.id} 
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onRowClick(kw)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{kw.keyword}</p>
                    {kw.targetUrl && (
                      <p className="text-xs text-gray-500 truncate max-w-xs">{kw.targetUrl}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(kw.latestRanking?.position)}`}>
                    {kw.latestRanking?.position ?? '-'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    kw.latestRanking?.change && kw.latestRanking.change > 0 ? 'text-green-600' :
                    kw.latestRanking?.change && kw.latestRanking.change < 0 ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {getChangeIndicator(kw.latestRanking?.change)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{kw.location}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    kw.device === 'mobile' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {kw.device}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {kw.lastCheckedAt ? new Date(kw.lastCheckedAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onCheck(kw.id)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100 transition-colors disabled:opacity-50"
                    >
                      Check
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this keyword?')) {
                          onDelete(kw.id);
                        }
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors disabled:opacity-50"
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
  );
}
