import type { AuditResult, CategoryResult } from '../types/audit';
import { ScoreCircle } from './ScoreCircle';

interface ResultsDashboardProps {
  result: AuditResult;
  onReset?: () => void;
}

export function ResultsDashboard({ result, onReset }: ResultsDashboardProps) {
  const { categories } = result;
  
  const passedChecks = categories.reduce((sum, cat) => sum + cat.passed, 0);
  const failedChecks = categories.reduce((sum, cat) => sum + cat.failed, 0);

  const allIssues = categories.flatMap(cat => 
    cat.checks.filter(check => check.status !== 'pass')
      .map(check => ({ ...check, category: cat.name }))
  ).sort((a, b) => a.score - b.score);

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {(() => { try { return new URL(result.url).hostname; } catch { return result.url; } })()}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {passedChecks} checks passed • {failedChecks} issues found
            </p>
          </div>
          <ScoreCircle score={result.overallScore} size="lg" />
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-4 text-sm text-primary-600 hover:text-primary-700"
          >
            ← Run another audit
          </button>
        )}
      </div>

      {allIssues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Issues to Fix ({allIssues.length})</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {allIssues.map((issue) => (
              <div key={issue.id} className="p-4 flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  issue.status === 'fail' ? 'bg-red-100' : 'bg-yellow-100'
                }`}>
                  {issue.status === 'fail' ? (
                    <span className="text-red-600 text-xs">✗</span>
                  ) : (
                    <span className="text-yellow-600 text-xs">!</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-400">{issue.category}</span>
                  <p className="font-medium text-gray-900">{issue.name}</p>
                  <p className="text-sm text-gray-600">{issue.message}</p>
                  {issue.details && (
                    <p className="text-xs text-gray-400 mt-1">{issue.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {categories.map((category) => (
          <CategoryRow key={category.name} category={category} />
        ))}
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: CategoryResult }) {
  const failedCount = category.checks.filter(c => c.status === 'fail').length;
  const warningCount = category.checks.filter(c => c.status === 'warning').length;
  const hasIssues = failedCount > 0 || warningCount > 0;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${
      failedCount > 0 ? 'border-red-200' : warningCount > 0 ? 'border-yellow-200' : 'border-gray-200'
    }`}>
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreCircle score={category.score} size="sm" />
          <div>
            <h4 className="font-medium text-gray-900">{category.name}</h4>
            {hasIssues ? (
              <p className="text-sm text-red-600">
                {failedCount > 0 && `${failedCount} failed`}
                {failedCount > 0 && warningCount > 0 && ' • '}
                {warningCount > 0 && `${warningCount} warnings`}
              </p>
            ) : (
              <p className="text-sm text-green-600">All checks passed</p>
            )}
          </div>
        </div>
        <span className="text-lg font-bold text-gray-400">{category.score}</span>
      </div>
    </div>
  );
}
