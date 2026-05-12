interface ScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreCircle({ score, size = 'lg' }: ScoreCircleProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  const getBgColor = (score: number) => {
    if (score >= 90) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-yellow-50 border-yellow-200';
    if (score >= 50) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const sizeClasses = {
    sm: 'w-16 h-16 text-xl',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl',
  };

  return (
    <div className={`${sizeClasses[size]} ${getBgColor(score)} rounded-full border-2 flex items-center justify-center`}>
      <span className={`font-bold ${getScoreColor(score)}`}>{Math.round(score)}</span>
    </div>
  );
}
