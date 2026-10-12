'use client';

// "Bu hafta önceliğin" (İlerlemem, 2026-10-12 — Sınav Hazırlık tasarımının ortaokul uyarlaması). En fazla 3
// iş: başladığın ama zorlandığın konular (kural lib/lessonReports.ts priorityTopics — başarı oranına göre,
// hiç başlanmamış konu okulda henüz işlenmemiş olabileceği için öne çıkmaz); tekrar zamanı gelen soru varsa
// son iş tekrardır. Eski "Zorlandığın konular" ve "Tekrar takvimi" bölümlerinin yerine.
import { useMemo } from 'react';
import Link from 'next/link';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { useReviewDue } from '@/app/src/hooks/useReviewDue';
import { priorityTopics, type PriorityTopic } from '@/app/src/lib/lessonReports';
import { MASTERY_RULES } from '@/app/src/lib/topicMastery';

function detail(t: PriorityTopic): string {
  if (t.solved < MASTERY_RULES.minSolvedToJudge) return `${t.lessonName} · ${t.solved} soru çözdün`;
  return `${t.lessonName} · başarı oranın %${t.accuracy}`;
}

const ITEM = 'flex items-center gap-3 rounded-2xl border border-default p-3 sm:px-4';
const NUM = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-black text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200';

export function WeeklyPriorities() {
  const { data: mastery, error } = useTopicMastery();
  const { data: reviewDue = 0 } = useReviewDue();
  const topics = useMemo(() => (mastery ? priorityTopics(mastery.lessons, reviewDue > 0 ? 2 : 3) : []), [mastery, reviewDue]);

  // Sınıfı seçilmemiş / hata: ders listesi zaten açıklıyor.
  if (error || mastery === null) return null;

  return (
    <section aria-labelledby="oncelik" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="oncelik" className="text-lg font-extrabold text-default sm:text-xl">
          Bu hafta önceliğin
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">başarı oranına göre</span>
      </div>

      {!mastery ? (
        <div aria-busy="true" aria-label="Öncelikler yükleniyor" className="h-48 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : topics.length === 0 && reviewDue === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">Şu an öne çıkan bir eksiğin yok. Ders raporlarından istediğin derse devam edebilirsin.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {topics.map((t, i) => (
            <li key={t.id} className={ITEM}>
              <span aria-hidden="true" className={NUM}>{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold leading-snug text-default">{t.title}</span>
                <span className="text-[13px] text-muted-foreground">{detail(t)}</span>
              </span>
              <Link
                href={t.href!}
                aria-label={`${t.title} sorularını çöz`}
                className="flex min-h-11 shrink-0 items-center rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700"
              >
                Çöz
              </Link>
            </li>
          ))}
          {reviewDue > 0 && (
            <li className={ITEM}>
              <span aria-hidden="true" className={NUM}>{topics.length + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold leading-snug text-default">Tekrar zamanı gelen {reviewDue} soru</span>
                <span className="text-[13px] text-muted-foreground">Daha önce çözdüğün sorular, unutmadan önce</span>
              </span>
              <Link
                href="/tekrar"
                className="flex min-h-11 shrink-0 items-center rounded-xl border border-indigo-600 px-4 text-sm font-extrabold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                Tekrar et
              </Link>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
