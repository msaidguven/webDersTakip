'use client';

// Temiz v1 etkileşimli ders iskeletine entegre 5 yeni oyunlaştırılmış pekiştirme bileşeni:
// 1. KavramAviStepView (Kavram Avı — harf çemberi)
// 2. SpotErrorStepView (Hata Avcısı — Dedektif Atom)
// 3. VaultLockStepView (Bilgi Kasası — kaçış kilidi)
// 4. SliderStepView (Deney / Karşılaştırma Sürgüsü)
// 5. SwipeSortStepView (Kaydır & Ayır)
// Tümü v1'in ferah, açık, akıllı tahta + mobil uyumlu tasarım dilini ve sınırsız deneme / kırmızı-puan-yok
// öğrenme anı ilkesini korur.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Lightbulb, Lock, Search, Unlock } from 'lucide-react';
import { HarfCemberi } from '@/app/src/components/kavram-avi/HarfCemberi';
import { KavramKutulari } from '@/app/src/components/kavram-avi/KavramKutulari';
import { useKavramOyunu } from '@/app/src/hooks/useKavramOyunu';
import type { Kavram } from '@/app/src/lib/kavramAvi';
import { LessonIcon } from '@/app/src/components/interactive/LessonFigure';
import type { RobotMood } from '@/app/src/components/interactive/RobotGuide';
import type { LessonSfx } from '@/app/src/lib/interactiveLesson/sound';
import { praiseAt } from '@/app/src/lib/interactiveLesson/guide';
import {
  termSlug,
  type KavramAviStep,
  type LessonTerm,
  type SliderStep,
  type SpotErrorStep,
  type SwipeSortStep,
  type VaultLockStep,
} from '@/app/src/lib/interactiveLesson/types';

export type GameDoneState = { solved: boolean; firstTry: boolean | null };
export type GameSpeech = { lines: string[]; mood?: RobotMood; tone?: 'ok' | 'retry' | 'info' | null; sfx?: LessonSfx };

type CommonProps = {
  index: number;
  state: GameDoneState | undefined;
  onChange: (s: GameDoneState) => void;
  say: (s: GameSpeech) => void;
  renderBubble: (node: ReactNode) => ReactNode;
  renderConceptText: (text: string) => ReactNode;
};

const PANEL = 'rounded-[22px] border-2 border-b-[5px] border-[#d7dff3] bg-white p-5 sm:p-6';

/* ---------------- 1. KAVRAM AVI ---------------- */

export function KavramAviStepView({
  step,
  terms,
  index,
  state,
  onChange,
  say,
  renderBubble,
  renderConceptText,
}: CommonProps & { step: KavramAviStep; terms: Record<string, LessonTerm> }) {
  const slug = step.term ?? termSlug(step.word);
  const definition = step.definition ?? terms[slug]?.description ?? '';
  const solved = !!state?.solved;

  const kavram = useMemo<Kavram>(
    () => ({ id: slug, kavram: step.word, tanim: definition }),
    [slug, step.word, definition],
  );

  const missed = useRef(false);
  const prevLen = useRef(0);
  const prevAktif = useRef(0);

  const oyun = useKavramOyunu(kavram, () => {
    onChange({ solved: true, firstTry: !missed.current });
    say({ lines: [praiseAt(index), step.explanation], mood: 'celebrate', tone: 'ok', sfx: 'ok' });
  });

  useEffect(() => {
    if (oyun.secim.length > prevLen.current) {
      say({ lines: [], mood: 'normal', sfx: 'link' });
    }
    prevLen.current = oyun.secim.length;
  }, [oyun.secim.length, say]);

  useEffect(() => {
    if (oyun.aktif > prevAktif.current && !oyun.tamamlandi) {
      say({ lines: ['İlk kelime tamam! Sıradaki kelimeyi birleştir.'], mood: 'happy', tone: 'ok', sfx: 'ok' });
    }
    prevAktif.current = oyun.aktif;
  }, [oyun.aktif, oyun.tamamlandi, say]);

  useEffect(() => {
    if (!oyun.yanlis) return;
    missed.current = true;
    say({ lines: ['Olmadı, harfleri tekrar birleştir ya da ipucu kullan.'], mood: 'oops', tone: 'retry', sfx: 'retry' });
  }, [oyun.yanlis, say]);

  return (
    <div className="space-y-4">
      {renderBubble(
        <>
          <p className="font-bold text-slate-900">{step.prompt}</p>
          {solved && (
            <p className="mt-2 text-emerald-800">
              <strong>{praiseAt(index)}</strong> {renderConceptText(step.explanation)}
            </p>
          )}
        </>,
      )}

      <div className={`${PANEL} mx-auto max-w-2xl`}>
        {definition && (
          <p className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-center text-[0.98rem] font-semibold leading-relaxed text-slate-800">
            “{definition}”
          </p>
        )}

        {solved ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-5 py-2.5 text-xl font-black tracking-widest text-emerald-900">
              <Check className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              {step.word}
            </span>
            <p className="text-sm font-semibold text-slate-600">Kavramı başarıyla buldun! Devam edebilirsin.</p>
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-5"
            style={
              {
                '--r-bg': '#f8fafc',
                '--r-surface': '#ffffff',
                '--r-surface-alt': '#eef2fb',
                '--r-border': '#cbd5e1',
                '--r-text': '#0f172a',
                '--r-text-muted': '#64748b',
                '--r-accent': '#f97316',
                '--r-accent-soft': '#fff7ed',
                '--r-accent-border': '#fdba74',
                '--r-accent-text': '#c2410c',
              } as React.CSSProperties
            }
          >
            <KavramKutulari kelimeler={oyun.kelimeler} aktif={oyun.aktif} ipucu={oyun.ipucu} />
            <HarfCemberi
              harfler={oyun.harfler}
              secim={oyun.secim}
              secilenKelime={oyun.secilenKelime}
              yanlis={oyun.yanlis}
              ipucuBitti={oyun.ipucuBitti}
              onHarfSec={oyun.harfSec}
              onGonder={oyun.gonder}
              onTemizle={oyun.temizle}
              onKaristir={oyun.karistir}
              onIpucu={oyun.ipucuAc}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- 2. HATA AVCISI (DEDEKTİF ATOM) ---------------- */

export function SpotErrorStepView({
  step,
  index,
  state,
  onChange,
  say,
  renderBubble,
  renderConceptText,
}: CommonProps & { step: SpotErrorStep }) {
  const solved = !!state?.solved;
  const [badIdx, setBadIdx] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const missed = useRef(false);

  const handlePick = (i: number) => {
    if (solved) return;
    if (i === step.errorIndex) {
      onChange({ solved: true, firstTry: !missed.current });
      say({ lines: [praiseAt(index), step.explanation], mood: 'celebrate', tone: 'ok', sfx: 'unlock' });
      return;
    }
    missed.current = true;
    setBadIdx(i);
    setHintShown(true);
    say({ lines: [`Bu kelime doğru görünüyor. İpucu: ${step.hint}`], mood: 'detective', tone: 'retry', sfx: 'retry' });
    window.setTimeout(() => setBadIdx(null), 500);
  };

  return (
    <div className="space-y-4">
      {renderBubble(
        <>
          <p className="font-bold text-slate-900">{step.prompt}</p>
          {!solved && hintShown && (
            <p className="mt-2 font-semibold text-amber-900">
              <strong>İpucu:</strong> {step.hint}
            </p>
          )}
          {solved && (
            <p className="mt-2 text-emerald-800">
              <strong>{praiseAt(index)}</strong> {renderConceptText(step.explanation)}
            </p>
          )}
        </>,
      )}

      <div className={`${PANEL} mx-auto max-w-3xl overflow-hidden !p-0`}>
        <div className="flex items-center justify-between gap-2 bg-slate-900 px-5 py-3 text-xs font-extrabold tracking-wider text-slate-100">
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4 text-sky-400" aria-hidden="true" />
            DEDEKTİF İNCELEMESİ
          </span>
          <span
            className={`rounded-full px-3 py-0.5 text-[11px] ${
              solved ? 'bg-emerald-500/25 text-emerald-200' : 'bg-amber-400/20 text-amber-200'
            }`}
          >
            {solved ? 'HATA DÜZELTİLDİ' : '1 BİLİMSEL HATA VAR'}
          </span>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-center gap-2.5" role="group" aria-label="Yanlış kelimeye dokun">
            {step.tokens.map((tok, i) => {
              const isErr = i === step.errorIndex;
              const isBad = badIdx === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={solved}
                  onClick={() => handlePick(i)}
                  className={`rounded-2xl border-2 border-b-4 px-4 py-2.5 text-lg font-extrabold transition ${
                    solved && isErr
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : isBad
                        ? 'border-amber-400 bg-amber-50 text-amber-950'
                        : 'border-slate-200 bg-white text-slate-900 hover:border-sky-400 hover:bg-sky-50 active:translate-y-0.5'
                  }`}
                >
                  {solved && isErr ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-sm line-through opacity-50">{tok}</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {step.correction}
                      </span>
                    </span>
                  ) : (
                    tok
                  )}
                </button>
              );
            })}
          </div>

          {!solved && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-slate-500">Cümlede yanlış olan tek kelimeye dokun.</span>
              {!hintShown && (
                <button
                  type="button"
                  onClick={() => {
                    setHintShown(true);
                    say({ lines: [`İpucu: ${step.hint}`], mood: 'detective', tone: 'info', sfx: 'tap' });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-extrabold text-amber-900 hover:bg-amber-100"
                >
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                  İpucu göster
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3. BİLGİ KASASI (KAÇIŞ KİLİDİ) ---------------- */

export function VaultLockStepView({
  step,
  index,
  state,
  onChange,
  say,
  renderBubble,
  renderConceptText,
}: CommonProps & { step: VaultLockStep }) {
  const alreadySolved = !!state?.solved;
  const [activeDial, setActiveDial] = useState(0);
  const [lockedIn, setLockedIn] = useState<Record<number, number>>(() =>
    alreadySolved ? Object.fromEntries(step.dials.map((d, i) => [i, d.answer])) : {},
  );
  const [badOpt, setBadOpt] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const missed = useRef(false);

  const solvedCount = Object.keys(lockedIn).length;
  const allOpen = alreadySolved || solvedCount === step.dials.length;
  const dial = step.dials[activeDial];

  const handleOption = (optIdx: number) => {
    if (allOpen || lockedIn[activeDial] !== undefined || !dial) return;
    if (optIdx === dial.answer) {
      const next = { ...lockedIn, [activeDial]: optIdx };
      setLockedIn(next);
      if (Object.keys(next).length === step.dials.length) {
        onChange({ solved: true, firstTry: !missed.current });
        say({ lines: [praiseAt(index), step.explanation], mood: 'celebrate', tone: 'ok', sfx: 'unlock' });
      } else {
        say({ lines: [`${activeDial + 1}. kilit açıldı! Sıradaki şifreyi çöz.`], mood: 'happy', tone: 'ok', sfx: 'unlock' });
        const nextIdx = step.dials.findIndex((_, i) => next[i] === undefined);
        if (nextIdx >= 0) window.setTimeout(() => setActiveDial(nextIdx), 320);
      }
      return;
    }
    missed.current = true;
    setBadOpt(optIdx);
    say({ lines: ['Kilit dönmedi, ipucunu dikkatlice okuyup başka bir şifre dene.'], mood: 'oops', tone: 'retry', sfx: 'retry' });
    window.setTimeout(() => setBadOpt(null), 420);
  };

  return (
    <div className="space-y-4">
      {renderBubble(
        <>
          <p className="font-bold text-slate-900">{step.prompt}</p>
          {!allOpen && hintShown && step.hint && (
            <p className="mt-2 font-semibold text-amber-900">
              <strong>İpucu:</strong> {step.hint}
            </p>
          )}
          {allOpen && (
            <p className="mt-2 text-emerald-800">
              <strong>{praiseAt(index)}</strong> {renderConceptText(step.explanation)}
            </p>
          )}
        </>,
      )}

      <div
        className={`mx-auto max-w-3xl rounded-[24px] border-2 p-5 sm:p-6 transition-colors ${
          allOpen ? 'border-emerald-400 bg-slate-900 text-white' : 'border-slate-700 bg-slate-900 text-white'
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {allOpen ? (
              <Unlock className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5 text-amber-400" aria-hidden="true" />
            )}
            <h3 className="text-base font-extrabold tracking-wide text-slate-100">{step.vaultTitle ?? 'Bilgi Kasası'}</h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
              allOpen ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/20 text-amber-200'
            }`}
          >
            {allOpen ? 'KASA AÇILDI' : `${solvedCount} / ${step.dials.length} KİLİT`}
          </span>
        </div>

        {/* Kilit kadranları */}
        <div className="mb-4 grid gap-2.5 sm:grid-cols-3" role="tablist" aria-label="Kilit kadranları">
          {step.dials.map((d, i) => {
            const isOpen = lockedIn[i] !== undefined;
            const isCur = i === activeDial && !allOpen;
            return (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={isCur}
                onClick={() => {
                  if (!allOpen) {
                    setActiveDial(i);
                    say({ lines: [d.clue], mood: 'detective', sfx: 'tap' });
                  }
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-3 text-center transition ${
                  isOpen
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                    : isCur
                      ? 'border-sky-400 bg-sky-500/15 text-white'
                      : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:border-slate-500'
                }`}
              >
                <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-75">Kilit #{i + 1}</span>
                <span className="text-sm font-black">{isOpen ? d.options[lockedIn[i]] : isCur ? 'Seçiliyor…' : 'Kilitli'}</span>
              </button>
            );
          })}
        </div>

        {allOpen ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-center">
            <p className="text-base font-extrabold text-emerald-200">Tüm şifreler doğrulandı — kasa açıldı!</p>
          </div>
        ) : (
          dial && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">İpucu #{activeDial + 1}</span>
                {step.hint && !hintShown && (
                  <button
                    type="button"
                    onClick={() => {
                      setHintShown(true);
                      say({ lines: [`İpucu: ${step.hint}`], mood: 'detective', tone: 'info', sfx: 'tap' });
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-0.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25"
                  >
                    <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
                    İpucu
                  </button>
                )}
              </div>
              <p className="mt-2 text-base font-bold leading-snug text-white">{dial.clue}</p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {dial.options.map((opt, optIdx) => {
                  const isBad = badOpt === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleOption(optIdx)}
                      className={`rounded-xl border-2 border-b-4 px-4 py-3 text-sm font-extrabold transition ${
                        isBad
                          ? 'border-amber-400 bg-amber-500/25 text-amber-100'
                          : 'border-slate-600 bg-slate-900 text-slate-100 hover:border-sky-400 hover:bg-slate-800 active:translate-y-0.5'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ---------------- 4. DENEY / KARŞILAŞTIRMA SÜRGÜSÜ ---------------- */

export function SliderStepView({
  step,
  index,
  state,
  onChange,
  say,
  renderBubble,
  renderConceptText,
}: CommonProps & { step: SliderStep }) {
  const solved = !!state?.solved;
  const [value, setValue] = useState(solved ? 100 : 0);

  const isRight = value >= 50;
  const active = isRight ? step.right : step.left;

  const handleChange = (v: number) => {
    setValue(v);
    if (v >= 85 && !solved) {
      onChange({ solved: true, firstTry: true });
      say({ lines: [praiseAt(index), step.explanation], mood: 'happy', tone: 'ok', sfx: 'ok' });
    }
  };

  return (
    <div className="space-y-4">
      {renderBubble(
        <>
          <p className="font-bold text-slate-900">{step.prompt}</p>
          {solved && (
            <p className="mt-2 text-emerald-800">
              <strong>{praiseAt(index)}</strong> {renderConceptText(step.explanation)}
            </p>
          )}
        </>,
      )}

      <div className={`${PANEL} mx-auto max-w-3xl space-y-5`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { side: step.left, active: !isRight, color: 'border-amber-400 bg-amber-50/70' },
            { side: step.right, active: isRight, color: 'border-sky-400 bg-sky-50/70' },
          ].map(({ side, active: isAct, color }, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border-2 p-4 transition-all ${
                isAct ? `${color} scale-[1.01] shadow-sm` : 'border-slate-200 bg-slate-50/60 opacity-55'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {side.icon && (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-800 shadow-sm">
                    <LessonIcon name={side.icon} className="h-5 w-5" />
                  </span>
                )}
                <h4 className="font-extrabold text-slate-900">{side.label}</h4>
              </div>
              <p className="mt-2.5 text-[0.98rem] font-semibold leading-relaxed text-slate-700">{side.text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold text-slate-600">
            <span>{step.left.label}</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-slate-900 ring-1 ring-slate-200">
              {active.label} (%{value})
            </span>
            <span>{step.right.label}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => handleChange(Number(e.target.value))}
            aria-label="Karşılaştırma sürgüsü"
            className="h-3.5 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-amber-400 to-sky-500 accent-slate-900"
          />
          {!solved && (
            <p className="mt-2 text-center text-xs font-bold text-slate-500">
              İki durumu karşılaştırmak için sürgüyü sağa doğru kaydır.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 5. KAYDIR & AYIR ---------------- */

export function SwipeSortStepView({
  step,
  index,
  state,
  onChange,
  say,
  renderBubble,
  renderConceptText,
}: CommonProps & { step: SwipeSortStep }) {
  const alreadySolved = !!state?.solved;
  const [idx, setIdx] = useState(alreadySolved ? step.items.length : 0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shake, setShake] = useState(false);
  const startX = useRef(0);
  const missed = useRef(false);

  const solved = alreadySolved || idx >= step.items.length;
  const current = step.items[idx];

  const judge = (side: 'L' | 'R') => {
    if (solved || !current) return;
    setDx(0);
    if (current.side === side) {
      const next = idx + 1;
      setIdx(next);
      if (next >= step.items.length) {
        onChange({ solved: true, firstTry: !missed.current });
        say({ lines: [praiseAt(index), step.explanation], mood: 'celebrate', tone: 'ok', sfx: 'combo' });
      } else {
        say({ lines: ['Doğru! Sıradaki karta bakalım.'], mood: 'happy', tone: 'ok', sfx: 'ok' });
      }
      return;
    }
    missed.current = true;
    setShake(true);
    say({ lines: [`İpucu: ${step.hint}`], mood: 'oops', tone: 'retry', sfx: 'retry' });
    window.setTimeout(() => setShake(false), 400);
  };

  return (
    <div className="space-y-4">
      {renderBubble(
        <>
          <p className="font-bold text-slate-900">{step.prompt}</p>
          {solved && (
            <p className="mt-2 text-emerald-800">
              <strong>{praiseAt(index)}</strong> {renderConceptText(step.explanation)}
            </p>
          )}
        </>,
      )}

      <div className={`${PANEL} mx-auto max-w-2xl space-y-4`}>
        {/* Adım noktaları */}
        <div className="flex items-center justify-center gap-1.5" aria-label={`${Math.min(idx + 1, step.items.length)}/${step.items.length}`}>
          {step.items.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < idx || solved ? 'w-6 bg-emerald-500' : i === idx ? 'w-8 bg-orange-500' : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {solved ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {(['L', 'R'] as const).map((side) => (
              <div key={side} className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                  {side === 'L' ? step.leftLabel : step.rightLabel}
                </p>
                <ul className="space-y-1.5 text-sm font-semibold text-slate-800">
                  {step.items
                    .filter((it) => it.side === side)
                    .map((it, k) => (
                      <li key={k} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>{it.text}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              onPointerDown={(e) => {
                startX.current = e.clientX;
                setDx(0);
                setDragging(true);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragging) return;
                setDx(e.clientX - startX.current);
              }}
              onPointerUp={() => {
                if (!dragging) return;
                setDragging(false);
                if (dx < -60) judge('L');
                else if (dx > 60) judge('R');
                else setDx(0);
              }}
              onPointerCancel={() => {
                setDragging(false);
                setDx(0);
              }}
              style={{
                transform: dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : undefined,
                touchAction: 'pan-y',
              }}
              className={`relative grid min-h-[130px] cursor-grab select-none place-items-center rounded-2xl border-2 border-b-[6px] bg-slate-50 px-6 py-6 text-center text-lg font-extrabold text-slate-900 transition ${
                dragging ? 'cursor-grabbing transition-none' : ''
              } ${
                shake
                  ? 'border-amber-400 bg-amber-50'
                  : dx < -30
                    ? 'border-sky-500 bg-sky-50'
                    : dx > 30
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200'
              }`}
            >
              {dx < -25 && (
                <span className="absolute left-3 top-3 rounded-lg bg-sky-600 px-2.5 py-0.5 text-xs font-black text-white">
                  {step.leftLabel}
                </span>
              )}
              {dx > 25 && (
                <span className="absolute right-3 top-3 rounded-lg bg-orange-600 px-2.5 py-0.5 text-xs font-black text-white">
                  {step.rightLabel}
                </span>
              )}
              <span>{current.text}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => judge('L')}
                className="min-h-[52px] rounded-2xl border-2 border-b-[5px] border-sky-600 bg-sky-500 px-4 py-2.5 text-base font-extrabold text-white transition hover:bg-sky-600 active:translate-y-0.5"
              >
                ← {step.leftLabel}
              </button>
              <button
                type="button"
                onClick={() => judge('R')}
                className="min-h-[52px] rounded-2xl border-2 border-b-[5px] border-orange-600 bg-orange-500 px-4 py-2.5 text-base font-extrabold text-white transition hover:bg-orange-600 active:translate-y-0.5"
              >
                {step.rightLabel} →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
