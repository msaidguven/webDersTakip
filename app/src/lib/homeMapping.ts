export function getGradeDescription(level: number): string {
  const descriptions: Record<number, string> = {
    5: 'Ortaokul 1. sınıf',
    6: 'Ortaokul 2. sınıf',
    7: 'Ortaokul 3. sınıf',
    8: 'Ortaokul 4. sınıf - LGS',
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

// Aktif sınıf seviyelerinden okunabilir aralık: [5,6,7] → "5, 6 ve 7. sınıf", [5..8] → "5-8. sınıf".
// Pazarlama metinleri ("5. sınıftan 12. sınıfa kadar") gerçekte olmayan sınıfları vaat
// etmesin diye elle yazılmıyor, veriden türetiliyor (2026-09-27).
export function formatGradeRange(levels: number[]): string {
  const sorted = [...new Set(levels.filter((l) => l > 0))].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `${sorted[0]}. sınıf`;
  const contiguous = sorted.every((l, i) => i === 0 || l === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 3) return `${sorted[0]}-${sorted[sorted.length - 1]}. sınıf`;
  return `${sorted.slice(0, -1).join(', ')} ve ${sorted[sorted.length - 1]}. sınıf`;
}
