import Link from 'next/link';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import { formatGradeRange } from '@/app/src/lib/homeMapping';
import type { SiteStats } from '@/app/src/lib/homeStats';
import type { DailyQuestion } from '@/app/src/lib/homeHighlights';
import { DailyQuestionCard } from './DailyQuestionCard';

// Sade anasayfa (2026-09-27 taslağı): solda net bir vaat + iki eylem + gerçek rakamlar, sağda
// Günün Sorusu. Eski hero görseli ve ayrı istatistik çubuğu (StatsBar) kaldırıldı — rakamlar
// burada, gerçek veriden.
export function HomeHero({
  isAuthenticated,
  gradeLevels,
  stats,
  dailyQuestion,
}: {
  isAuthenticated: boolean;
  gradeLevels: number[];
  stats: SiteStats;
  dailyQuestion: DailyQuestion | null;
}) {
  const gradeRange = formatGradeRange(gradeLevels);
  const figures = [
    { value: stats.lessonCount, label: 'ders' },
    { value: stats.topicCount, label: 'konu anlatımı' },
    { value: stats.questionCount, label: 'cevap anahtarlı soru' },
  ];

  return (
    <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
      <div className="flex flex-col gap-5 sm:gap-6">
        <span className="self-start rounded-full bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
          MEB müfredatına uygun{gradeRange ? ` · ${gradeRange}` : ''}
        </span>
        <h1 className="text-4xl font-black leading-[1.04] tracking-tight text-default sm:text-6xl">
          Konuyu öğren,
          <br />
          soruyu çöz,
          <br />
          <span className="text-indigo-600 dark:text-indigo-400">ilerlemeni gör.</span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Konu anlatımları, cevap anahtarlı soru bankası ve seni tanıyan testler.
          {!isAuthenticated && ' Üye olmadan da hepsini kullanabilirsin.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#dersler"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-indigo-700"
          >
            Sınıfını seç <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          {isAuthenticated ? (
            <Link
              href="/panel"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-default bg-background px-6 py-3.5 text-base font-bold text-default transition-colors hover:bg-surface"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Panele git
            </Link>
          ) : (
            <Link
              href="/soru-bankasi"
              className="inline-flex items-center justify-center rounded-2xl border border-default bg-background px-6 py-3.5 text-base font-bold text-default transition-colors hover:bg-surface"
            >
              Soru Bankası
            </Link>
          )}
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-4 border-t border-default pt-5 sm:flex sm:gap-8">
          {figures.map((f) => (
            <div key={f.label}>
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-2xl font-black text-default sm:text-3xl">{f.value.toLocaleString('tr-TR')}</dd>
              <dd className="text-xs text-muted-foreground sm:text-sm">{f.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      {dailyQuestion && <DailyQuestionCard data={dailyQuestion} />}
    </section>
  );
}
