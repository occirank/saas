import { GSCConnect } from '../components/GSCConnect';
import { GSCData } from '../components/GSCData';
import { useGSC } from '../hooks/useGSC';

export function GSCPage() {
  const { status } = useGSC();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Google Search Console</h2>
        <p className="text-gray-600">View search analytics, queries, and indexing data from Google Search Console.</p>
      </div>

      {/* Connection Status */}
      <GSCConnect />

      {/* Analytics Data - only show when connected */}
      {status?.connected && <GSCData />}
    </div>
  );
}
