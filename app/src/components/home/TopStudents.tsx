import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import type { TopStudentEntry } from '@/app/src/lib/leaderboard';

const MEDAL_STYLES = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950',
  'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950',
];

// Tüm sınıflardan bu haftanın en çok soru çözen öğrencileri — ziyaretçiyi/öğrenciyi
// çalışmaya teşvik etmek için (kullanıcı talebi 2026-09-26). Veri sunucuda (ISR) çekilir,
// isimler "Ad S." biçiminde gelir (bkz. get_public_weekly_top_students).
export function TopStudents({ students, isAuthenticated }: { students: TopStudentEntry[]; isAuthenticated: boolean }) {
  if (students.length === 0) return null;

  return (
    <section aria-labelledby="top-students-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="top-students-title" className="mb-1 flex items-center gap-2 text-lg font-black text-default sm:text-xl">
            <Trophy className="h-5 w-5 text-amber-500" /> Haftanın En Çalışkanları
          </h2>
          <p className="text-sm text-muted-foreground">Bu hafta en çok soru çözen öğrencilerimiz. Sıralama her Pazartesi sıfırlanır.</p>
        </div>
        <Link
          href={isAuthenticated ? '/soru-bankasi' : '/register'}
          className="inline-flex items-center gap-1 text-sm font-bold text-indigo-500 transition-colors hover:text-indigo-400"
        >
          {isAuthenticated ? 'Soru çöz, listeye gir' : 'Üye ol, sen de listeye gir'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {students.map((s) => (
          <li
            key={s.rank}
            className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-4 lg:flex-col lg:text-center"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                MEDAL_STYLES[s.rank - 1] ?? 'bg-indigo-500/10 text-indigo-500'
              }`}
              aria-label={`${s.rank}. sıra`}
            >
              {s.rank}
            </span>
            <div className="min-w-0 flex-1 lg:flex-none">
              <p className="truncate text-sm font-bold text-default">{s.displayName}</p>
              <p className="text-xs text-muted-foreground">{s.totalQuestions} soru</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
