'use client';

// Genel Konular İçin v3 Yapısal Görsel Sahne (Gemini AI worker ile üretilen tüm derslerde kullanılır).
// Web/masaüstünde yatay sahne oranına uygun dengeli akış; mobilde dikey okunaklı kartlar.
import { ArrowDown, ArrowRight, Equal, Plus, Sparkles } from 'lucide-react';
import type { V3BeatVisual } from '@/app/src/lib/interactiveLesson/typesV3';

export function GenericVisualScene({
  visual,
  title,
}: {
  visual?: V3BeatVisual;
  title: string;
}) {
  if (!visual) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 py-6 text-center">
        <Sparkles className="h-9 w-9 text-sky-500" aria-hidden="true" />
        <p className="m-0 font-black text-slate-900" style={{ fontSize: 'var(--fs-body)' }}>
          {title}
        </p>
      </div>
    );
  }

  if (visual.kind === 'highlight') {
    const useTwoCols = visual.bullets.length >= 2;
    return (
      <div className="flex w-full flex-col gap-3 p-1.5 sm:p-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="rounded-full bg-sky-100 px-3 py-1 font-extrabold text-sky-800"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            {visual.badge}
          </span>
          <h3 className="m-0 font-black text-slate-900" style={{ fontSize: 'var(--fs-choice)' }}>
            {visual.headline}
          </h3>
        </div>
        <div className={`grid grid-cols-1 gap-2.5 ${useTwoCols ? 'sm:grid-cols-2' : ''}`}>
          {visual.bullets.map((b, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 font-bold text-slate-800"
              style={{ fontSize: 'var(--fs-label)' }}
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-600 text-xs font-black text-white">
                {i + 1}
              </span>
              <span className="leading-snug">{b}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visual.kind === 'compare') {
    return (
      <div className="grid w-full grid-cols-1 gap-3.5 p-1 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-sky-300 bg-sky-50/85 p-4">
          <h4 className="m-0 mb-2.5 font-black text-sky-900" style={{ fontSize: 'var(--fs-choice)' }}>
            {visual.left.title}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {visual.left.points.map((p, i) => (
              <li
                key={i}
                className="rounded-xl bg-white/95 px-3 py-2 font-bold leading-snug text-slate-800 shadow-sm"
                style={{ fontSize: 'var(--fs-label)' }}
              >
                • {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/85 p-4">
          <h4 className="m-0 mb-2.5 font-black text-amber-900" style={{ fontSize: 'var(--fs-choice)' }}>
            {visual.right.title}
          </h4>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {visual.right.points.map((p, i) => (
              <li
                key={i}
                className="rounded-xl bg-white/95 px-3 py-2 font-bold leading-snug text-slate-800 shadow-sm"
                style={{ fontSize: 'var(--fs-label)' }}
              >
                • {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (visual.kind === 'steps') {
    const horizontalOnDesktop = visual.items.length <= 4;
    return (
      <div
        className={`w-full p-1.5 sm:p-2 ${
          horizontalOnDesktop
            ? 'flex flex-col items-stretch gap-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-2.5'
            : 'mx-auto flex max-w-2xl flex-col items-stretch gap-2'
        }`}
      >
        {visual.items.map((item, i) => (
          <div
            key={i}
            className={
              horizontalOnDesktop
                ? 'flex flex-col items-center sm:flex-1 sm:flex-row sm:items-center sm:gap-2.5'
                : 'flex flex-col items-center'
            }
          >
            <div className="flex h-full w-full items-center gap-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50/85 px-4 py-3.5 sm:flex-col sm:items-start sm:justify-start sm:gap-2.5">
              <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-black text-white shadow-sm">
                {i + 1}. Adım
              </span>
              <span className="font-extrabold leading-snug text-slate-900" style={{ fontSize: 'var(--fs-label)' }}>
                {item}
              </span>
            </div>
            {i < visual.items.length - 1 && (
              <>
                <ArrowDown
                  className={`my-0.5 h-4 w-4 shrink-0 text-indigo-400 ${horizontalOnDesktop ? 'sm:hidden' : ''}`}
                  aria-hidden="true"
                />
                {horizontalOnDesktop && (
                  <ArrowRight className="hidden h-5 w-5 shrink-0 text-indigo-400 sm:block" aria-hidden="true" />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (visual.kind === 'equation') {
    return (
      <div className="flex w-full flex-wrap items-center justify-center gap-3 p-3">
        {visual.inputs.map((inp, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className="rounded-2xl border-2 border-sky-300 bg-sky-50 px-4 py-3 font-extrabold text-sky-950"
              style={{ fontSize: 'var(--fs-choice)' }}
            >
              {inp}
            </span>
            {i < visual.inputs.length - 1 && (
              <Plus className="h-5 w-5 text-sky-500" aria-hidden="true" />
            )}
          </div>
        ))}
        <Equal className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        <span
          className="rounded-2xl border-2 border-emerald-400 bg-emerald-100 px-4 py-3 font-black text-emerald-950"
          style={{ fontSize: 'var(--fs-choice)' }}
        >
          {visual.result}
        </span>
      </div>
    );
  }

  // cards — kart sayısına göre otomatik ortalanmış dengeli ızgara
  const cardGridClass =
    visual.items.length === 1
      ? 'grid-cols-1 max-w-xl mx-auto'
      : visual.items.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : visual.items.length === 4
          ? 'grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

  return (
    <div className={`grid w-full gap-3 p-1 ${cardGridClass}`}>
      {visual.items.map((card, i) => (
        <div
          key={i}
          className="flex flex-col gap-1.5 rounded-2xl border-2 border-sky-200 bg-sky-50/80 p-4 text-left"
        >
          <span className="font-black text-sky-900" style={{ fontSize: 'var(--fs-choice)' }}>
            {card.title}
          </span>
          <span className="font-semibold leading-snug text-slate-700" style={{ fontSize: 'var(--fs-label)' }}>
            {card.detail}
          </span>
        </div>
      ))}
    </div>
  );
}
