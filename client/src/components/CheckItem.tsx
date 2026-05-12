import type { CheckResult } from '../types/audit';

interface CheckItemProps {
  check: CheckResult;
}

export function CheckItem({ check }: CheckItemProps) {
  const statusConfig = {
    pass: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    fail: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-600',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
  };

  const config = statusConfig[check.status];

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`p-1 rounded-full ${config.bg} ${config.text} mt-0.5`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-gray-900">{check.name}</h4>
            {check.value !== undefined && (
              <span className="text-sm text-gray-500 font-mono">{check.value}</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{check.message}</p>
          {check.details && (
            <p className="text-xs text-gray-400 mt-1">{check.details}</p>
          )}
        </div>
      </div>
    </div>
  );
}
