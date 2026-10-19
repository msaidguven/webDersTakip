'use client';

// "Son 7 gün" özeti (İlerlemem, yol haritası 4c — 2026-09-28 taslağı). Takvim haftası değil
// KAYAN 7 gün: pazartesi sabahı "geçen haftadan az çözdün" demek yanıltıcı olurdu. Takvim
// haftası yalnızca "Son 4 hafta" tablosunda.
import { useMemo } from 'react';
import { ArrowDown, Flame, Target, Trophy, BookOpen, type LucideIcon } from 'lucide-react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { useMyProfileBasics } from '@/app/src/hooks/useMyGradeSlug';
import { addDays, istanbulToday, summarizeActivity, type ProgressSummary as Summary } from '@/app/src/lib/progressActivity';
import { badgeHighlight, type BadgeHighlight } from '@/app/src/lib/badges';
import r from '../robotic/robotic.module.css';

// Başlık cümlesi (2026-10-20): sayıyı haftalık hedefe (günlük hedef × 7) ve çalışılan gün sayısına göre
// yorumlar; "3 soru, harika başlangıç!" gibi her sayıyı öven cümle yok. Önceki 7 günle kıyas ek olarak.
// "7 günün 5'inde": sayının iyelik + bulunma eki.
const DAY_SUFFIX = ['', "'inde", "'sinde", "'ünde", "'ünde", "'inde", "'sında", "'sinde"];

const cap = (t: string) => t[0].toLocaleUpperCase('tr-TR') + t.slice(1);

function headline(s: Summary, activeDays: number, dailyGoal: number | null): string {
  const n = s.last7.answered;
  if (n === 0) return 'Son 7 günde soru çözmedin. Bugün birkaç soruyla başla!';
  const prev = s.prev7.answered;
  const trend = prev === 0 ? '' : n > prev ? ` Önceki 7 günden ${n - prev} fazla.` : n < prev ? ` Önceki 7 günden ${prev - n} az.` : '';
  const days = `7 günün ${activeDays}${DAY_SUFFIX[activeDays]} ${n} soru çözdün`;
  if (!dailyGoal) return `${cap(days)}.${trend}`;
  const target = dailyGoal * 7;
  const ratio = n / target;
  if (ratio >= 1) return `${cap(days)}, haftalık hedefin ${target} soruydu. Hedefi geçtin!${trend}`;
  if (ratio >= 0.6) return `${cap(days)}. Haftalık hedefin ${target}, az kaldı.${trend}`;
  if (activeDays <= 2) return `${cap(days)}. Hedefin haftada ${target} soru: her gün biraz çözmeyi dene.${trend}`;
  return `${cap(days)}, hedefin ${target}. Günde ${dailyGoal} soruya çıkmayı dene.${trend}`;
}

function Tile({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 px-2.5 py-1.5 ${r.stat}`} title={note}>
      <Icon className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />
      <span className={`whitespace-nowrap text-base ${r.statValue}`}>{value}</span>
      <span className={`truncate text-xs ${r.muted}`}>{label}</span>
    </div>
  );
}

export function ProgressSummary() {
  const { data, error } = useProgressActivity();
  const summary = useMemo(() => (data ? summarizeActivity(data) : null), [data]);
  const highlight = useMemo(() => (data ? badgeHighlight(data) : null), [data]);
  const activeDays7 = useMemo(() => {
    const from = addDays(istanbulToday(), -6);
    return (data ?? []).filter((d) => d.day >= from && d.answered > 0).length;
  }, [data]);
  const dailyGoal = useMyProfileBasics()?.dailyGoal ?? null;
  const { data: mastery } = useTopicMastery();
  const learned = useMemo(() => {
    if (!mastery?.lessons.length) return null;
    const topics = mastery.lessons.flatMap((l) => l.topics);
    const upcoming = mastery.lessons.reduce((n, l) => n + l.upcoming, 0);
    return { done: topics.filter((t) => t.state === 'learned').length, total: topics.length + upcoming };
  }, [mastery]);

  if (error) {
    return (
      <p role="alert" className={`p-4 text-sm text-muted-foreground ${r.panel}`}>
        Özetin şu an yüklenemedi. Sayfayı yenilemeyi dene.
      </p>
    );
  }
  if (!summary) {
    return <div aria-busy="true" aria-label="Özet yükleniyor" className="h-24 animate-pulse rounded-2xl bg-surface-elevated" />;
  }

  const { last7, prev7 } = summary;
  return (
    <section
      aria-labelledby="son-7-gun"
      className={`flex flex-col gap-3 px-4 py-3 ${r.panel} ${r.hero}`}
    >
      <span className={r.scan} aria-hidden="true" />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <p className="min-w-0 text-sm font-semibold text-default sm:text-base">
          <span id="son-7-gun" className={`mr-2 ${r.label}`}>Son 7 gün</span>
          {headline(summary, activeDays7, dailyGoal)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Tile
            icon={Target}
            label="doğru"
            value={last7.accuracy == null ? '—' : `%${last7.accuracy}`}
            note={prev7.accuracy == null ? 'son 7 günde' : `önceki: %${prev7.accuracy}`}
          />
          <Tile icon={Flame} label="seri" value={`${summary.currentStreak} gün`} note={`en uzun: ${summary.longestStreak} gün`} />
          {/* En az bir konu öğrenildiyse "öğrenilen konu"; yoksa toplam soru ("0/90" cesaret kırıyordu, 2026-10-11). */}
          {learned && learned.done > 0 ? (
            <Tile icon={BookOpen} label="konu" value={`${learned.done}/${learned.total}`} note="öğrenilen konu" />
          ) : (
            <Tile icon={BookOpen} label="soru" value={String(summary.totalAnswered)} note="toplam çözülen soru" />
          )}
        </div>
      </div>
      {highlight && <BadgeLine highlight={highlight} />}
    </section>
  );
}

// Rozet motivasyonu tek satırda (2026-09-29): öğrenci bir sonraki hedefini burada görsün.
function BadgeLine({ highlight }: { highlight: NonNullable<BadgeHighlight> }) {
  const { badge } = highlight;
  return (
    <a href="#rozetlerim" className={`flex items-center gap-2 border-t pt-2 text-xs text-default sm:text-sm ${r.divider}`}>
      <Trophy className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />
      {highlight.kind === 'recent' ? (
        <span className="min-w-0 flex-1 truncate">Bu hafta <b>{badge.title}</b> rozetini kazandın!</span>
      ) : (
        <>
          <span className="min-w-0 truncate">Sıradaki rozet: <b>{badge.title}</b> · {badge.remainingLabel} kaldı</span>
          <span className={`block h-1.5 w-24 shrink-0 sm:w-40 ${r.track}`} role="img" aria-label={`İlerleme: ${badge.progressLabel}`}>
            <span className={`block ${r.fill}`} style={{ width: `${badge.progress}%` }} />
          </span>
        </>
      )}
      <ArrowDown className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
