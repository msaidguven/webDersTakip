'use client';

// Dedektif Atom — Hata Avcısı: Kanıt dosyasındaki bilimsel hatayı bul, damgala ve düzelt.
import { useRef, useState } from 'react';
import type { V2SpotErrorStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function SpotErrorGame({ step, onReact, onMiss, onComplete }: { step: V2SpotErrorStep } & GameCallbacks) {
  const [solved, setSolved] = useState(false);
  const [badIdx, setBadIdx] = useState<number | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const missedOnce = useRef(false);

  const handleTap = (idx: number) => {
    if (solved) return;
    if (idx === step.errorIndex) {
      setSolved(true);
      onReact('celebrate', step.feedback, 'ok', 'unlock');
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setBadIdx(idx);
    setHintOpen(true);
    onReact('detective', `Bu ifade doğru görünüyor. İpucu: ${step.hint}`, 'oops', 'retry');
    window.setTimeout(() => setBadIdx(null), 420);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className={s.dossierWrap}>
        <div className={s.dossierHead}>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-sky-300" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.4" />
              <path d="M15.5 15.5L20.5 20.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            <span>DEDEKTİF DOSYASI</span>
          </span>
          <span className={`${s.dossierStatus} ${solved ? s.dossierStatusOk : ''}`}>
            {solved ? 'DÜZELTİLDİ ✓' : '1 HATA TESPİT EDİLDİ'}
          </span>
        </div>

        <div className={s.tokenBox} role="group" aria-label="Yanlış kelimeyi seç">
          {step.tokens.map((tok, i) => {
            const isErrorSlot = i === step.errorIndex;
            const isBad = badIdx === i;
            return (
              <button
                key={i}
                type="button"
                disabled={solved}
                onClick={() => handleTap(i)}
                className={`${s.tokenChip} ${solved && isErrorSlot ? s.tokenFixed : isBad ? s.tileBad : ''}`}
              >
                {solved && isErrorSlot ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs line-through opacity-55">{tok}</span>
                    <span>✓ {step.correction}</span>
                  </span>
                ) : (
                  tok
                )}
              </button>
            );
          })}
        </div>

        {!solved && (
          <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500">Şüpheli kelimeye dokun</span>
            {!hintOpen ? (
              <button
                type="button"
                onClick={() => {
                  setHintOpen(true);
                  onReact('detective', `İpucu: ${step.hint}`, 'normal', 'tap');
                }}
                className={s.miniHintBtn}
              >
                İpucu Göster
              </button>
            ) : (
              <span className="text-xs font-extrabold text-amber-700">İpucu açık</span>
            )}
          </div>
        )}
      </div>

      {solved && (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Kanıtı Onayla ve Devam Et →
        </button>
      )}
    </div>
  );
}
