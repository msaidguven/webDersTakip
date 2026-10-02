'use client';

// Ders raporu (İlerlemem, eski "Konu haritam" kutu ızgarası — 2026-10-02 kullanıcı isteğiyle sade
// rapora çevrildi). Her ders tek satır: öğrenilen konu sayısı + durum dağılımı çubuğu; satıra
// dokununca konu listesi açılır (durum yazıyla, renk tek başına anlam taşımaz). Durum kuralı
// lib/topicMastery.ts'te. Zorlanılan konular ayrıca "Zorlandığın konular" bölümünde listelenir.
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { MASTERY_LABEL, type LessonMastery, type MasteryState, type TopicMastery } from '@/app/src/lib/topicMastery';

const BAR: Record<MasteryState, string> = {
  learned: 'bg-indigo-600',
  building: 'bg-indigo-300 dark:bg-indigo-400/60',
  weak: 'bg-orange-400',
  new: 'bg-transparent',
};
const BADGE: Record<MasteryState, string> = {
  learned: 'bg-indigo-600 text-white',
  building: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  weak: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
  new: 'bg-surface-elevated text-muted-foreground',
};
const COUNT_LABEL: Record<MasteryState, string> = {
  learned: 'öğrenildi',
  building: 'pekişiyor',
  weak: 'zorlanıyor',
  new: 'başlanmadı',
};
const ORDER: MasteryState[] = ['learned', 'building', 'weak', 'new'];

function topicDetail(t: TopicMastery): string {
  if (t.state === 'new') return `${t.total} soru`;
  return `%${t.accuracy} · ${t.solved}/${t.total} soru`;
}

function LessonRow({ lesson }: { lesson: LessonMastery }) {
  const total = lesson.topics.length;
  const summary = ORDER.filter((s) => lesson.counts[s] > 0)
    .map((s) => `${lesson.counts[s]} ${COUNT_LABEL[s]}`)
    .join(' · ');

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-xl py-4 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-semibold text-default">{lesson.name}</span>
              <span className="text-sm font-semibold text-default">
                {lesson.counts.learned} / {total} konu öğrenildi
              </span>
            </span>
            <span className="flex h-2 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
              {ORDER.map((s) =>
                lesson.counts[s] > 0 ? <span key={s} className={BAR[s]} style={{ width: `${(lesson.counts[s] / total) * 100}%` }} /> : null
              )}
            </span>
            <span className="text-xs text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <ul className="mb-4 divide-y divide-[var(--border)] rounded-xl border border-default">
          {lesson.topics.map((t) => {
            const body = (
              <>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-default">{t.title}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{topicDetail(t)}</span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${BADGE[t.state]}`}>{MASTERY_LABEL[t.state]}</span>
              </>
            );
            const cls = 'flex min-h-11 items-center gap-3 px-3 py-2';
            return (
              <li key={t.id}>
                {t.href ? (
                  <Link href={t.href} className={`${cls} transition-colors hover:bg-surface-elevated`} aria-label={`${t.title}: ${MASTERY_LABEL[t.state]}, ${topicDetail(t)}`}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
        {lesson.href && (
          <Link href={lesson.href} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            {lesson.name} Soru Bankası <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </details>
    </li>
  );
}

export function TopicMap() {
  const { data, error, isLoading } = useTopicMastery();

  return (
    <section aria-labelledby="ders-raporu" className="flex flex-col gap-2 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="ders-raporu" className="text-lg font-extrabold text-default sm:text-xl">
          Ders raporu
        </h2>
        <p className="text-sm text-muted-foreground">Her derste kaç konuyu öğrendin. Konuları görmek için derse dokun.</p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">Ders raporun şu an yüklenemedi. Sayfayı yenilemeyi dene.</p>
      ) : isLoading || data === undefined ? (
        <div aria-busy="true" aria-label="Ders raporu yükleniyor" className="h-40 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">
          Ders raporunu görmek için{' '}
          <Link href="/profil" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            profilinden sınıfını seç
          </Link>
          .
        </p>
      ) : data.lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sınıfında henüz sorusu olan konu yok. Yeni konular eklendikçe burada görünecek.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} />
          ))}
        </ul>
      )}
    </section>
  );
}
