'use client';

// Konu haritam (İlerlemem, yol haritası 4e). Her ders altında konular kutu kutu; renk = ustalık
// durumu (kural: lib/topicMastery.ts). Kutu, o konunun Soru Bankası sayfasına gider.
// Renkler yalnız tonla değil açıklıkla da ayrışır (renk körlüğü): beyaz → açık turuncu →
// açık indigo → koyu indigo.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { MASTERY_LABEL, type MasteryState, type TopicMastery } from '@/app/src/lib/topicMastery';

const TILE: Record<MasteryState, string> = {
  new: 'border-default bg-background text-muted-foreground',
  weak: 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200',
  building: 'border-indigo-300 bg-indigo-100 text-indigo-950 dark:border-indigo-400/40 dark:bg-indigo-500/20 dark:text-indigo-100',
  // Koyu temada da indigo-600: beyaz yazı indigo-500 üstünde WCAG AA sınırının altında kalıyor.
  learned: 'border-indigo-600 bg-indigo-600 text-white',
};
const LEGEND_ORDER: MasteryState[] = ['new', 'weak', 'building', 'learned'];

function tileDetail(t: TopicMastery): string {
  if (t.state === 'new') return `${t.total} soru`;
  return `${t.solved}/${t.total} soru · %${t.accuracy}`;
}

function Tile({ topic }: { topic: TopicMastery }) {
  const cls = `flex min-h-[76px] flex-col justify-between gap-2 rounded-2xl border p-3 text-left transition-transform ${TILE[topic.state]}`;
  const body = (
    <>
      <span className="text-[13px] font-bold leading-snug">{topic.title}</span>
      <span className="text-xs font-semibold opacity-80">{tileDetail(topic)}</span>
    </>
  );
  const label = `${topic.title}: ${MASTERY_LABEL[topic.state]}, ${tileDetail(topic)}`;
  return topic.href ? (
    <Link href={topic.href} aria-label={label} className={`${cls} hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`}>
      {body}
    </Link>
  ) : (
    <div aria-label={label} className={cls}>
      {body}
    </div>
  );
}

export function TopicMap() {
  const { data, error, isLoading } = useTopicMastery();

  return (
    <section aria-labelledby="konu-haritam" className="flex flex-col gap-5 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="konu-haritam" className="text-lg font-extrabold text-default sm:text-xl">
            Konu haritam
          </h2>
          <p className="text-sm text-muted-foreground">Her kutu bir konu. Dokun, o konunun sorularına git.</p>
        </div>
        <ul aria-label="Renklerin anlamı" className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-bold text-muted-foreground sm:flex sm:gap-4">
          {LEGEND_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-3.5 w-3.5 rounded border ${TILE[s]}`} />
              {MASTERY_LABEL[s]}
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">Konu haritan şu an yüklenemedi. Sayfayı yenilemeyi dene.</p>
      ) : isLoading || data === undefined ? (
        <div aria-busy="true" aria-label="Konu haritası yükleniyor" className="h-56 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : data === null ? (
        <p className="text-sm text-muted-foreground">
          Konu haritanı görmek için{' '}
          <Link href="/profil" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            profilinden sınıfını seç
          </Link>
          .
        </p>
      ) : data.lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sınıfında henüz sorusu olan konu yok. Yeni konular eklendikçe burada görünecek.</p>
      ) : (
        data.lessons.map((lesson) => (
          <div key={lesson.id} className="flex flex-col gap-2.5 border-t border-default pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-base font-extrabold text-default">{lesson.name}</h3>
              <span className="flex items-center gap-3 text-[13px] font-semibold text-muted-foreground">
                {lesson.counts.learned} / {lesson.topics.length} konu öğrenildi
                {lesson.href && (
                  <Link href={lesson.href} className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:underline dark:text-indigo-400">
                    Soru Bankası <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {lesson.topics.map((t) => (
                <Tile key={t.id} topic={t} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
