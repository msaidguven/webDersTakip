'use client';

// Motor 6: Tahmin Et & İlerle (step_reveal).
// Tek odak / tek soru ilkesi: Aktif aşamada ekranda yalnızca bir önceki adımın kısa bağlamı,
// sıradaki tek soru ve 2 büyük seçenek yer alır. Tamamlanan zincir yalnızca bitişte özetlenir.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3StepRevealVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, ITEM_JEWELS, type AccentKey } from './labTheme';

function buildOptionOrders(count: number): [0 | 1, 0 | 1][] {
  return Array.from({ length: count }, () => (Math.random() < 0.5 ? [0, 1] : [1, 0]));
}

export function StepRevealLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3StepRevealVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];
  const [optionOrders] = useState<[0 | 1, 0 | 1][]>(() =>
    buildOptionOrders(visual.nextSteps.length),
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [status, setStatus] = useState<'idle' | 'ok' | 'wrong'>('idle');
  const [wrongOptIdx, setWrongOptIdx] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const total = visual.nextSteps.length;
  const currentStep = visual.nextSteps[stepIdx];
  const prevStepText =
    stepIdx === 0
      ? visual.startStep
      : visual.nextSteps[stepIdx - 1]?.options[visual.nextSteps[stepIdx - 1].answer] ?? visual.startStep;

  const handleChoose = (optIdx: 0 | 1) => {
    if (done || status === 'ok' || !currentStep) return;
    lessonSound().unlock();

    if (optIdx === currentStep.answer) {
      setWrongOptIdx(null);
      setStatus('ok');
      const isLast = stepIdx + 1 >= total;

      if (isLast) {
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
          else if (soundOn) lessonSound().sfx('ok');
        }
        timerRef.current = setTimeout(() => {
          setDone(true);
        }, 900);
      } else {
        if (soundOn) lessonSound().sfx('ok');
        timerRef.current = setTimeout(() => {
          setStepIdx((i) => i + 1);
          setStatus('idle');
        }, 1050);
      }
    } else {
      setWrongOptIdx(optIdx);
      setStatus('wrong');
      if (soundOn) lessonSound().sfx('retry');
    }
  };

  const displayPair = optionOrders[stepIdx] ?? [0, 1];

  return (
    <div className="flex w-full flex-col items-center gap-3 px-1 py-1 sm:gap-3.5 sm:px-2">
      {/* Üst Satır: Kısa Görev + İlerleme Noktaları */}
      <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
        <p
          className="m-0 font-extrabold leading-snug"
          style={{ fontSize: 'var(--fs-label)', color: palette.titleText }}
        >
          {visual.task}
        </p>

        <div className="flex items-center gap-1.5" aria-label={`${done ? total : stepIdx} / ${total}`}>
          {visual.nextSteps.map((_, i) => {
            const passed = done || i < stepIdx || (i === stepIdx && status === 'ok');
            const active = !done && i === stepIdx && status !== 'ok';
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
        /* Tamamlandı: Temiz Süreç Özeti */
        <div className="flex w-full max-w-2xl flex-col gap-2.5">
          <div
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-extrabold text-emerald-900"
            style={{ fontSize: 'var(--fs-sm)' }}
            aria-live="polite"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Harika! Sürecin tüm adımlarını doğru tamamladın.</span>
          </div>

          <div
            className="flex flex-col gap-1.5 rounded-2xl border bg-white p-3.5"
            style={{ borderColor: palette.headerBorder, background: palette.headerBg }}
          >
            {[visual.startStep, ...visual.nextSteps.map((st) => st.options[st.answer])].map((text, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-white px-3 py-2 font-bold text-slate-800 shadow-sm"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-white">
                  {idx + 1}
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Tek Odaklı Aktif Soru Kartı */
        currentStep && (
          <>
            <div
              className="relative flex w-full max-w-2xl flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 bg-white px-4 py-4 text-center sm:px-5 sm:py-5"
              style={{
                borderColor:
                  status === 'ok'
                    ? '#34d399'
                    : status === 'wrong'
                      ? '#fcd34d'
                      : palette.cardBorder,
                boxShadow: status === 'idle' ? palette.cardShadow : undefined,
              }}
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

              {/* Tek satırlık önceki adım bağlamı */}
              <div
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 font-bold text-slate-600"
                style={{
                  background: palette.headerBg,
                  borderColor: palette.headerBorder,
                  fontSize: 'var(--fs-sm)',
                }}
              >
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                <span className="truncate">{prevStepText}</span>
              </div>

              <p
                className="m-0 font-black leading-snug text-slate-900"
                style={{ fontSize: 'var(--fs-choice)' }}
              >
                {currentStep.prompt}
              </p>

              <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                {displayPair.map((optIdx, posIdx) => {
                  const text = currentStep.options[optIdx];
                  const jewel = jewels[posIdx % jewels.length];
                  const isOkBtn = status === 'ok' && optIdx === currentStep.answer;
                  const isWrongBtn = status === 'wrong' && optIdx === wrongOptIdx;
                  return (
                    <button
                      key={`${stepIdx}-${optIdx}`}
                      type="button"
                      disabled={status === 'ok'}
                      onClick={() => handleChoose(optIdx)}
                      className={`inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-2.5 font-extrabold transition-all duration-150 active:translate-y-0.5 ${
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
                      <span>{text}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {status !== 'idle' && (
              <div className="w-full max-w-2xl" aria-live="polite">
                {status === 'ok' ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-bold text-emerald-900"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{currentStep.okNote}</span>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-center font-bold text-amber-900"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span>Bir kez daha düşün; diğer seçeneği incele!</span>
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
