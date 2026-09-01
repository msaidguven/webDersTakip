import { BookMarked, GraduationCap, HelpCircle, Layers, Users } from 'lucide-react';
import type { SiteStats } from '@/app/src/lib/homeStats';

function formatCount(n: number): string {
  return n.toLocaleString('tr-TR');
}

export function StatsBar({ stats }: { stats: SiteStats }) {
  const items = [
    { icon: GraduationCap, value: stats.gradeCount, label: 'Sınıf' },
    { icon: BookMarked, value: stats.lessonCount, label: 'Ders' },
    { icon: Layers, value: stats.unitCount, label: 'Ünite' },
    { icon: HelpCircle, value: stats.questionCount, label: 'Soru' },
    { icon: Users, value: stats.studentCount, label: 'Öğrenci' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:flex-nowrap sm:gap-2">
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label} className="flex flex-1 items-center justify-center gap-2.5 px-2 py-1.5 sm:px-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 text-indigo-500">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="text-left">
            <p className="text-base font-black leading-none text-default sm:text-lg">{formatCount(value)}</p>
            <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
