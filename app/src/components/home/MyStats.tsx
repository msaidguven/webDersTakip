'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { BarChart3, CheckCircle2, Target, XCircle } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { getOverallStats, type OverallStats } from '@/app/src/lib/dashboardStats';

const EMPTY_STATS: OverallStats = { totalQuestions: 0, correctAnswers: 0, wrongAnswers: 0, accuracy: 0 };

export function MyStats() {
  const { user, supabase } = useAuth();

  const { data: stats } = useSWR(
    user ? ['overall-stats', user.id] : null,
    () => getOverallStats(supabase, user!.id),
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const s = stats ?? EMPTY_STATS;

  const tiles = [
    { icon: BarChart3, iconClass: 'text-indigo-500', value: s.totalQuestions, label: 'Çözülen Soru' },
    { icon: CheckCircle2, iconClass: 'text-emerald-500', value: s.correctAnswers, label: 'Doğru' },
    { icon: XCircle, iconClass: 'text-rose-500', value: s.wrongAnswers, label: 'Yanlış' },
    { icon: Target, iconClass: 'text-amber-500', value: `${s.accuracy}%`, label: 'Başarı Oranı' },
  ];

  return (
    <div className="rounded-2xl border border-default bg-surface-elevated p-5 sm:p-6">
      <h3 className="mb-4 flex items-center gap-2 text-base font-black text-default">
        <BarChart3 className="h-5 w-5 text-indigo-500" /> İstatistiklerin
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl bg-background/60 p-3 text-center">
            <tile.icon className={`mx-auto mb-1.5 h-5 w-5 ${tile.iconClass}`} />
            <p className="text-lg font-black text-default">{tile.value}</p>
            <p className="text-xs font-medium text-muted-foreground">{tile.label}</p>
          </div>
        ))}
      </div>
      <Link
        href="/panel"
        className="mt-4 block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3 text-center text-sm font-black text-white transition-opacity hover:opacity-90"
      >
        Panelime Git
      </Link>
    </div>
  );
}
