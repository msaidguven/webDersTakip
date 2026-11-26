'use client';

// Motor 5: Tek Dokunuşla Ayır (classify_tap).
// Ortada tek bir gerçek örnek kart, altta 2-3 büyük kategori butonu.
// Öğrenci kendi karar vererek her örneği doğru gruba ayırır; 1 saniyede anlaşılır, tek ekrana sığar.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3ClassifyTapVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, ITEM_JEWELS, type AccentKey } from './labTheme';

export function ClassifyTapLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3ClassifyTapVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];
  const [cardIdx, setCardIdx] = useState(0);
  const [status, setStatus] = useState<'idle' | 'ok' | 'wrong'>('idle');
  const [wrongBucketIdx, setWrongBucketIdx] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const total = visual.cards.length;
  const currentCard = visual.cards[cardIdx];

  const handleChooseBucket = (bucketIdx: number) => {
    if (done || status === 'ok' || !currentCard) return;
    lessonSound().unlock();

    if (bucketIdx === currentCard.bucketIndex) {
      setWrongBucketIdx(null);
      setStatus('ok');
      const isLast = cardIdx + 1 >= total;

      if (isLast) {
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
          else if (soundOn) lessonSound().sfx('ok');
        }
        timerRef.current = setTimeout(() => {
          setDone(true);
        }, 850);
      } else {
        if (soundOn) lessonSound().sfx('ok');
        timerRef.current = setTimeout(() => {
          setCardIdx((i) => i + 1);
          setStatus('idle');
        }, 950);
      }
    } else {
      setWrongBucketIdx(bucketIdx);
      setStatus('wrong');
      if (soundOn) lessonSound().sfx('retry');
    }
  };

  const bucketGridClass =
    visual.buckets.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2';

  return (
    <div className="flex w-full flex-col items-center gap-3 px-1 py-1 sm:gap-3.5 sm:px-2">
      {/* Üst Satır: Net Görev + İlerleme Noktaları */}
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <p
          className="m-0 font-extrabold leading-snug"
          style={{ fontSize: 'var(--fs-label)', color: palette.titleText }}
        >
          {visual.task}
        </p>

        <div className="flex items-center gap-1.5" aria-label={`${done ? total : cardIdx} / ${total}`}>
          {visual.cards.map((_, i) => {
            const passed = done || i < cardIdx || (i === cardIdx && status === 'ok');
            const active = !done && i === cardIdx && status !== 'ok';
            return (
              <span
                key={i}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  passed
                    ? 'w-5 bg-emerald-500'
                    : active
                      ? 'w-5 bg-sky-500'
                      : 'w-2.5 bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {done ? (
        /* Tamamlandı: Öğrencinin ayırdığı örneklerin temiz özet tablosu */
        <div className="flex w-full flex-col gap-2.5">
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 font-extrabold text-emerald-800"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Harika! {total} örneğin hepsini doğru ayırdın.</span>
          </div>

          <div className={`grid w-full gap-2.5 ${bucketGridClass}`}>
            {visual.buckets.map((bucket, bIdx) => {
              const jewel = jewels[bIdx % jewels.length];
              const groupCards = visual.cards.filter((c) => c.bucketIndex === bIdx);
              return (
                <div
                  key={bucket}
                  className="flex flex-col gap-1.5 rounded-xl border bg-white p-3 text-left"
                  style={{ borderColor: jewel.border, background: jewel.softBg }}
                >
                  <span
                    className="font-black text-slate-900"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    {bucket}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {groupCards.map((c) => (
                      <span
                        key={c.text}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/80"
                        style={{ fontSize: 'var(--fs-sm)' }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                        <span>{c.text}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Aktif Kart + Büyük Kategori Düğmeleri */
        <>
          <div
            className={`relative flex w-full max-w-xl flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border-2 px-5 py-4 text-center transition-all duration-200 ${
              status === 'ok'
                ? 'border-emerald-400 bg-emerald-50/80'
                : status === 'wrong'
                  ? 'border-amber-300 bg-amber-50/75'
                  : 'bg-white'
            }`}
            style={
              status === 'idle'
                ? {
                    borderColor: palette.cardBorder,
                    boxShadow: palette.cardShadow,
                  }
                : undefined
            }
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1"
              style={{
                background:
                  status === 'ok'
                    ? 'linear-gradient(90deg, #34d399 0%, #059669 100%)'
                    : palette.topStrip,
              }}
            />
            <span
              className="font-bold text-slate-400"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              Örnek {cardIdx + 1} / {total}
            </span>
            <p
              className="m-0 font-black tracking-tight text-slate-900"
              style={{ fontSize: 'var(--fs-choice)' }}
            >
              {currentCard?.text}
            </p>
          </div>

          {/* 2 veya 3 Büyük Dokunmatik Kategori Butonu */}
          <div className={`grid w-full max-w-xl gap-2.5 ${bucketGridClass}`}>
            {visual.buckets.map((bucket, bIdx) => {
              const jewel = jewels[bIdx % jewels.length];
              const isOkBtn = status === 'ok' && bIdx === currentCard?.bucketIndex;
              const isWrongBtn = status === 'wrong' && bIdx === wrongBucketIdx;
              return (
                <button
                  key={bucket}
                  type="button"
                  disabled={status === 'ok'}
                  onClick={() => handleChooseBucket(bIdx)}
                  className={`inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 font-black transition-all duration-150 active:translate-y-0.5 ${
                    isOkBtn
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                      : isWrongBtn
                        ? 'border-amber-300 bg-amber-50 text-amber-800 opacity-70'
                        : 'bg-white text-slate-900 hover:-translate-y-0.5'
                  }`}
                  style={
                    !isOkBtn && !isWrongBtn
                      ? {
                          borderColor: jewel.border,
                          background: jewel.softBg,
                          boxShadow: `0 4px 0 ${jewel.border}`,
                          fontSize: 'var(--fs-label)',
                        }
                      : { fontSize: 'var(--fs-label)' }
                  }
                >
                  {isOkBtn && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span>{bucket}</span>
                </button>
              );
            })}
          </div>

          {/* Anlık Öğretici Dönüt (Doğru veya Yanlışta) */}
          {status !== 'idle' && currentCard && (
            <div className="w-full max-w-xl" aria-live="polite">
              {status === 'ok' ? (
                <div
                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-bold text-emerald-900"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{currentCard.note}</span>
                </div>
              ) : (
                <div
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-center font-bold text-amber-900"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>Tekrar düşün: {currentCard.note}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
