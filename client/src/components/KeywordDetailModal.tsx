import type { KeywordWithRanking } from '../types/keywords';

interface KeywordDetailModalProps {
  keyword: KeywordWithRanking | null;
  isOpen: boolean;
  onClose: () => void;
  onCheck: (id: string) => void;
  onDelete?: (id: string) => void;
}

function getPositionColor(position: number | null | undefined): string {
  if (!position) return 'bg-gray-100 text-gray-800';
  if (position <= 3) return 'bg-green-100 text-green-800';
  if (position <= 10) return 'bg-blue-100 text-blue-800';
  if (position <= 20) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export function KeywordDetailModal({ keyword, isOpen, onClose, onCheck, onDelete }: KeywordDetailModalProps) {
  if (!isOpen || !keyword) return null;

    const ranking = keyword.latestRanking;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Keyword Details</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Keyword</label>
                        <p className="text-lg font-semibold text-gray-900">{keyword.keyword}</p>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Position</label>
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPositionColor(ranking?.position)}`}>
                                {ranking?.position ?? 'Not ranked'}
                            </span>
                            <button
                                onClick={() => onCheck(keyword.id)}
                                className="text-xs text-primary-600 hover:text-primary-800"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Change</label>
                        <p className="text-sm">
                            {ranking?.change && ranking.change > 0 ? (
                                <span className="text-green-600">↑{ranking.change}</span>
                            ) : ranking?.change && ranking.change < 0 ? (
                                <span className="text-red-600">↓{Math.abs(ranking.change)}</span>
                            ) : (
                                <span className="text-gray-500">-</span>
                            )}
                        </p>
                    </div>

                    {ranking?.urlFound && (
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Ranking URL</label>
                            <a
                                href={ranking.urlFound}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:underline text-sm break-all block"
                            >
                                {ranking.urlFound}
                            </a>
                        </div>
                    )}

                    <div className="flex gap-6">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
                            <p className="text-gray-900">{keyword.location}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase">Device</label>
                            <p className="text-gray-900 capitalize">{keyword.device}</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Last Checked</label>
                        <p className="text-gray-900">
                            {keyword.lastCheckedAt ? new Date(keyword.lastCheckedAt).toLocaleString() : 'Never'}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                    {onDelete && (
                        <button
                            onClick={() => {
                                if (confirm('Delete this keyword?')) {
                                    onDelete(keyword.id);
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
