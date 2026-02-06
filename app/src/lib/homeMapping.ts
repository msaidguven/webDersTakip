export function getGradeDescription(level: number): string {
  const descriptions: Record<number, string> = {
    6: '',
    7: 'Ortaokul 2. seviye',
    8: 'Ortaokul 3. seviye - LGS',
    9: 'Lise 1. sinif',
    10: 'Lise 2. sinif',
    11: 'Lise 3. sinif - YKS hazirlik',
    12: 'Lise 4. sinif - YKS',
  };
  return descriptions[level] || `${level}. Sinif`;
}

export function getGradeIcon(level: number): string {
  const icons: Record<number, string> = {
    6: '📚', 7: '📖', 8: '🎯', 9: '🎓', 10: '🔬', 11: '⚡', 12: '🚀',
  };
  return icons[level] || '📖';
}

export function getGradeColor(level: number): string {
  const colors: Record<number, string> = {
    6: 'from-emerald-500 to-teal-500',
    7: 'from-cyan-500 to-blue-500',
    8: 'from-blue-500 to-indigo-500',
    9: 'from-indigo-500 to-purple-500',
    10: 'from-purple-500 to-pink-500',
    11: 'from-pink-500 to-rose-500',
    12: 'from-orange-500 to-amber-500',
  };
  return colors[level] || 'from-indigo-500 to-purple-500';
}

export function getLessonColor(index: number): string {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-cyan-500 to-blue-500',
    'from-blue-500 to-indigo-500',
    'from-purple-500 to-pink-500',
    'from-pink-500 to-rose-500',
    'from-orange-500 to-amber-500',
  ];
  return colors[index % colors.length];
}
