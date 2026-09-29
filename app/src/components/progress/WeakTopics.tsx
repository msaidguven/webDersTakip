'use client';

// En çok zorlandığın konular (İlerlemem, yol haritası 4f). Konu haritasıyla aynı SWR verisi —
// ek istek yok. "Çöz", konunun Soru Bankası sayfasına gider (girişli öğrenciye orada önce
// kişisel test önerilir).
import { useMemo } from 'react';
import Link from 'next/link';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { MASTERY_RULES, masteryCoverage, weakestTopics } from '@/app/src/lib/topicMastery';

export function WeakTopics() {
  const { data, error, isLoading } = useTopicMastery();
  const topics = useMemo(() => (data ? weakestTopics(data.lessons) : []), [data]);
  const coverage = useMemo(() => (data ? masteryCoverage(data.lessons) : null), [data]);
  const minSolved = MASTERY_RULES.minSolvedToJudge;
  const threshold = Math.round(MASTERY_RULES.weakAccuracy * 100);

  // Sınıfı olmayan / hata: konu haritası zaten açıklıyor, burada tekrar etme.
  if (error || data === null) return null;

  return (
    <section aria-labelledby="zorlandigin-konular" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="zorlandigin-konular" className="text-lg font-extrabold text-default sm:text-xl">
          En çok zorlandığın konular
        </h2>
        <p className="text-sm text-muted-foreground">
          En az {minSolved} soru çözdüğün ve başarın %{threshold} sınırının altında kalan konular. En düşük olan en üstte.
        </p>
      </div>

      {isLoading || data === undefined ? (
        <div aria-busy="true" aria-label="Konular yükleniyor" className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : topics.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">
          Başarısı %{threshold} sınırının altında kalan bir konun yok. Bir konunun burada değerlendirilmesi için o konudan en az {minSolved} soru çözmelisin.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {topics.map((t, i) => (
            <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-default bg-surface/50 p-3 sm:gap-4 sm:px-4">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-black text-orange-900 dark:bg-orange-500/15 dark:text-orange-200"
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-extrabold leading-snug text-default">{t.title}</span>
                <span className="text-[13px] text-muted-foreground">
                  {/* Bölünmez boşluk: mobilde "6 / yanlış" diye sayıdan kopmasın. */}
                  {t.lessonName} · {`%${t.accuracy} doğru`} · {`${t.wrong} yanlış`}
                </span>
              </div>
              {t.href && (
                <Link
                  href={t.href}
                  aria-label={`${t.title} sorularını çöz`}
                  className="flex min-h-11 shrink-0 items-center rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700"
                >
                  Çöz
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      {coverage && (coverage.tooFewSolved > 0 || coverage.notStarted > 0) && (
        <ul className="flex flex-col gap-1.5 border-t border-default pt-3 text-[13px] text-muted-foreground">
          {coverage.tooFewSolved > 0 && (
            <li>
              {coverage.tooFewSolved} konuda henüz {minSolved} soru çözmedin; değerlendirmek için veri az.
            </li>
          )}
          {coverage.notStarted > 0 && (
            <li>
              Henüz başlamadığın {coverage.notStarted} konu var.{' '}
              <a href="#derslerim" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
                Konu haritasında gör
              </a>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
