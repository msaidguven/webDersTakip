'use client';

// İlerlemem → "Ders raporları" (2026-10-12, Sınav Hazırlık tasarımından). Her ders tek satır: başarı oranı
// çubuğu, çözülen soru; dokununca /ilerlemem/[ders] raporu açılır. Eski satır içi açılan konu listesi ders sayfasına
// taşındı (ünite satırları açılır, UnitProgressChart). İsabet en az MASTERY_RULES.minSolvedToJudge soruda gösterilir.
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { accuracyTone, lessonHref, totalsOf } from '@/app/src/lib/lessonReports';
import { MASTERY_RULES } from '@/app/src/lib/topicMastery';

export const TONE_BAR = {
  good: 'bg-emerald-500',
  mid: 'bg-amber-500',
  bad: 'bg-rose-500',
  none: 'bg-transparent',
} as const;

export const TONE_TEXT = {
  good: 'text-emerald-700 dark:text-emerald-400',
  mid: 'text-amber-700 dark:text-amber-400',
  bad: 'text-rose-700 dark:text-rose-400',
  none: 'text-muted-foreground',
} as const;

export function LessonList() {
  const { data: mastery, error, isLoading } = useTopicMastery();

  return (
    <section aria-labelledby="ders-raporlari" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="ders-raporlari" className="text-lg font-extrabold text-default sm:text-xl">
          Ders raporları
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">grafikler ve konular için derse dokun</span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">Ders raporların şu an yüklenemedi. Sayfayı yenilemeyi dene.</p>
      ) : isLoading || mastery === undefined ? (
        <div aria-busy="true" aria-label="Ders raporları yükleniyor" className="h-72 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : mastery === null ? (
        <p className="text-sm text-muted-foreground">
          Ders raporlarını görmek için{' '}
          <Link href="/profil" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            profilinden sınıfını seç
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-default">
          {mastery.lessons.map((l) => {
            const t = totalsOf(l.topics);
            const tone = accuracyTone(t.accuracy);
            if (t.total === 0 || !l.slug) {
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="font-semibold text-default">{l.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">Sorular hazırlanıyor</span>
                </li>
              );
            }
            return (
              <li key={l.id}>
                <Link href={lessonHref(l.slug)} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold text-default">{l.name}</span>
                      <span className={`shrink-0 text-sm font-black tabular-nums ${TONE_TEXT[tone]}`}>
                        {t.accuracy == null ? '—' : `%${t.accuracy}`}
                      </span>
                    </span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                      <span className={`block h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${t.accuracy ?? 0}%` }} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.solved}/{t.total} soru çözüldü
                      {t.accuracy == null && t.solved > 0 && ` · başarı oranı için en az ${MASTERY_RULES.minSolvedToJudge} soru`}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
