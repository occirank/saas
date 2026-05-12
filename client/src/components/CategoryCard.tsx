import type { CategoryResult } from '../types/audit';
import { ScoreCircle } from './ScoreCircle';
import { CheckItem } from './CheckItem';

interface CategoryCardProps {
  category: CategoryResult;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ScoreCircle score={category.score} size="sm" />
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{category.name}</h3>
            <p className="text-sm text-gray-500">
              {category.passed} passed, {category.failed} issues
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {category.checks.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}
