'use client';

// Ders raporları (2026-10-12, Sınav Hazırlık tasarımından). Her ders bir kart: ders ikonu, başarı oranı,
// çözülen soru ve çubuk; dokununca /ilerlemem/[ders] raporu açılır (ünite grafiği, konular). İsabet en az
// MASTERY_RULES.minSolvedToJudge soruda gösterilir.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { accuracyTone, lessonHref, totalsOf } from '@/app/src/lib/lessonReports';
import { MASTERY_RULES } from '@/app/src/lib/topicMastery';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import r from '../robotic/robotic.module.css';

export const TONE_TEXT = {
  good: 'text-emerald-600 dark:text-emerald-400',
  mid: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
  none: 'text-muted-foreground',
} as const;

const CARD = `group flex flex-col gap-4 rounded-2xl p-4 ${r.panel}`;

export function LessonList() {
  const { data: mastery, error, isLoading } = useTopicMastery();

  return (
    <section aria-labelledby="ders-raporlari" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="ders-raporlari" className={`text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          Ders raporların
        </h2>
        <span className="text-xs font-medium text-muted-foreground">derse dokun, konuları gör</span>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">Ders raporların şu an yüklenemedi. Sayfayı yenilemeyi dene.</p>
      ) : isLoading || mastery === undefined ? (
        <div aria-busy="true" aria-label="Ders raporları yükleniyor" className="h-72 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : mastery === null ? (
        <p className="text-sm text-muted-foreground">
          Ders raporlarını görmek için{' '}
          <Link href="/profil" className={`font-semibold hover:underline ${r.accent}`}>
            profilinden sınıfını seç
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mastery.lessons.map((l) => {
            const t = totalsOf(l.topics);
            const tone = accuracyTone(t.accuracy);
            if (t.total === 0 || !l.slug) {
              return (
                <li key={l.id} className={`${CARD} opacity-60`}>
                  <div className="flex items-center gap-3">
                    <SubjectIcon lessonName={l.name} variant="solid" />
                    <span className="font-semibold text-default">{l.name}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Sorular hazırlanıyor</span>
                </li>
              );
            }
            return (
              <li key={l.id}>
                <Link href={lessonHref(l.slug)} className={`${CARD} ${r.itemHover} transition-transform hover:-translate-y-0.5`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <SubjectIcon lessonName={l.name} variant="solid" />
                      <span className="min-w-0 truncate font-semibold text-default">{l.name}</span>
                    </div>
                    <ArrowRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${r.accent}`} aria-hidden="true" />
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t.solved}/{t.total} soru · {t.correct} doğru · {t.solved - t.correct} yanlış
                      {t.accuracy == null && t.solved > 0 && ` · başarı oranı için en az ${MASTERY_RULES.minSolvedToJudge} soru`}
                    </span>
                    <span className={`text-xl ${r.statValue} ${TONE_TEXT[tone]}`}>{t.accuracy == null ? '—' : `%${t.accuracy}`}</span>
                  </div>
                  {/* Anasayfadaki ders çubuğuyla aynı: doğru / yanlış / çözülmedi (kalan iz). */}
                  <span
                    className={`flex h-2.5 ${r.track}`}
                    role="img"
                    aria-label={`${t.total} sorunun ${t.correct} doğru, ${t.solved - t.correct} yanlış, ${t.total - t.solved} çözülmedi`}
                  >
                    <span className="h-full bg-emerald-500" style={{ width: `${(t.correct / t.total) * 100}%` }} />
                    <span className="h-full bg-rose-500" style={{ width: `${((t.solved - t.correct) / t.total) * 100}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
