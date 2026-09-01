'use client';

import type { Grade } from '@/app/src/models/homeTypes';

export function GradeTabs({
  grades,
  selectedGradeId,
  onSelect,
}: {
  grades: Grade[];
  selectedGradeId: string | null;
  onSelect: (gradeId: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-black text-default sm:text-xl">🎓 Sınıfını Seç ve Keşfet</h2>
      <p className="mb-4 text-sm text-muted-foreground">İçerikleri görmek istediğin sınıfı seç.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {grades.map((grade) => {
          const isActive = grade.id === selectedGradeId;
          return (
            <button
              key={grade.id}
              type="button"
              onClick={() => onSelect(grade.id)}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                isActive
                  ? 'border-transparent shadow-lg'
                  : 'border-default bg-surface-elevated hover:-translate-y-0.5 hover:shadow-md'
              }`}
            >
              {isActive && <div className={`absolute inset-0 bg-gradient-to-br ${grade.color}`} />}
              {!isActive && (
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${grade.color} opacity-0 transition-opacity group-hover:opacity-[0.08]`} />
              )}
              <span
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${
                  isActive ? 'bg-white/20' : `bg-gradient-to-br ${grade.color}`
                }`}
              >
                {grade.icon}
              </span>
              <span className="relative min-w-0">
                <span className={`block text-base font-black ${isActive ? 'text-white' : 'text-default'}`}>{grade.level}. Sınıf</span>
                <span className={`block truncate text-xs font-bold ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                  {grade.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
