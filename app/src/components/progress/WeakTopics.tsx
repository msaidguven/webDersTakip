'use client';

// En çok zorlandığın konular (İlerlemem, yol haritası 4f). Konu haritasıyla aynı SWR verisi —
// ek istek yok. "Çöz", konunun Soru Bankası sayfasına gider (girişli öğrenciye orada önce
// kişisel test önerilir).
import { useMemo } from 'react';
import Link from 'next/link';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { weakestTopics } from '@/app/src/lib/topicMastery';

export function WeakTopics() {
  const { data, error, isLoading } = useTopicMastery();
  const topics = useMemo(() => (data ? weakestTopics(data.lessons) : []), [data]);
  // Sınıfı olmayan / hata: konu haritası zaten açıklıyor, burada tekrar etme.
  if (error || data === null) return null;
  // Sadeleştirme (2026-10-11): zorlandığı konu yoksa bölüm hiç görünmez — eşik/kural anlatan uzun
  // boş durum metni ve "veri az / başlamadığın konu" notları ortaokul öğrencisine gereksiz yüktü.
  if (data && topics.length === 0) return null;

  return (
    <section aria-labelledby="zorlandigin-konular" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="zorlandigin-konular" className="text-lg font-extrabold text-default sm:text-xl">
          Zorlandığın konular
        </h2>
        <p className="text-sm text-muted-foreground">Bu konularda yanlışın çok. Biraz daha çöz, güçlen.</p>
      </div>

      {isLoading || data === undefined ? (
        <div aria-busy="true" aria-label="Konular yükleniyor" className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
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

    </section>
  );
}
