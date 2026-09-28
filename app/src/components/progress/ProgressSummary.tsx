'use client';

// "Son 7 gün" özeti (İlerlemem, yol haritası 4c — 2026-09-28 taslağı). Takvim haftası değil
// KAYAN 7 gün: pazartesi sabahı "geçen haftadan az çözdün" demek yanıltıcı olurdu. Takvim
// haftası yalnızca "Son 4 hafta" tablosunda.
import { useMemo } from 'react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { summarizeActivity, type ProgressSummary as Summary } from '@/app/src/lib/progressActivity';

function headline(s: Summary): string {
  const n = s.last7.answered;
  if (n === 0) return 'Son 7 günde soru çözmedin. Bugün birkaç soruyla başla.';
  if (s.prev7.answered === 0) return `Son 7 günde ${n} soru çözdün.`;
  const diff = n - s.prev7.answered;
  if (diff === 0) return `${n} soru çözdün, önceki 7 günle aynı.`;
  return `${n} soru çözdün, önceki 7 günden ${Math.abs(diff)} soru ${diff > 0 ? 'fazla' : 'az'}.`;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-indigo-100 bg-background p-3 dark:border-indigo-500/20 sm:p-4">
      <span className="truncate text-xs font-bold text-muted-foreground sm:text-[13px]">{label}</span>
      <span className="whitespace-nowrap text-xl font-black text-default sm:text-3xl">{value}</span>
      <span className="text-xs leading-snug text-muted-foreground sm:text-[13px]">{note}</span>
    </div>
  );
}

export function ProgressSummary() {
  const { data, error } = useProgressActivity();
  const summary = useMemo(() => (data ? summarizeActivity(data) : null), [data]);
  const { data: mastery } = useTopicMastery();
  const learned = useMemo(() => {
    if (!mastery?.lessons.length) return null;
    const topics = mastery.lessons.flatMap((l) => l.topics);
    return { done: topics.filter((t) => t.state === 'learned').length, total: topics.length };
  }, [mastery]);

  if (error) {
    return (
      <p role="alert" className="rounded-2xl border border-default bg-surface p-4 text-sm text-muted-foreground">
        Özetin şu an yüklenemedi. Sayfayı yenilemeyi dene.
      </p>
    );
  }
  if (!summary) {
    return <div aria-busy="true" aria-label="Özet yükleniyor" className="h-56 animate-pulse rounded-[26px] bg-surface-elevated lg:h-40" />;
  }

  const { last7, prev7 } = summary;
  return (
    <section
      aria-labelledby="son-7-gun"
      className="grid grid-cols-1 gap-5 rounded-[26px] border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-8 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:items-center"
    >
      <div className="flex flex-col gap-2">
        <h2 id="son-7-gun" className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          Son 7 gün
        </h2>
        <p className="text-xl font-extrabold leading-snug text-default sm:text-2xl">{headline(summary)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:contents">
        <Tile
          label="Doğruluk"
          value={last7.accuracy == null ? '—' : `%${last7.accuracy}`}
          note={prev7.accuracy == null ? 'son 7 günde' : `önceki: %${prev7.accuracy}`}
        />
        <Tile
          label="Seri"
          value={`${summary.currentStreak} gün`}
          note={`en uzun: ${summary.longestStreak} gün`}
        />
        {/* Sınıf/konu verisi varsa taslaktaki "öğrenilen konu"; yoksa toplam soru. */}
        {learned ? (
          <Tile label="Öğrenilen" value={`${learned.done}/${learned.total}`} note="konu" />
        ) : (
          <Tile label="Toplam" value={String(summary.totalAnswered)} note="çözülen soru" />
        )}
      </div>
    </section>
  );
}
