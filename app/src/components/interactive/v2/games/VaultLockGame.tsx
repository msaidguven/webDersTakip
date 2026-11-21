'use client';

// Bilgi Kaçış Kilidi (Vault Lock): İpuçlarını çözerek kilit kadranlarını hizala ve kasayı aç!
import { useRef, useState } from 'react';
import type { V2VaultLockStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function VaultLockGame({ step, onReact, onMiss, onComplete }: { step: V2VaultLockStep } & GameCallbacks) {
  const [activeDial, setActiveDial] = useState(0);
  const [lockedIn, setLockedIn] = useState<Record<number, number>>({});
  const [badOpt, setBadOpt] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const missedOnce = useRef(false);

  const solvedCount = Object.keys(lockedIn).length;
  const allOpen = solvedCount === step.dials.length;
  const dial = step.dials[activeDial];

  const handleOption = (optIdx: number) => {
    if (allOpen || lockedIn[activeDial] !== undefined || !dial) return;

    if (optIdx === dial.answer) {
      const next = { ...lockedIn, [activeDial]: optIdx };
      setLockedIn(next);
      const nextCount = Object.keys(next).length;
      if (nextCount === step.dials.length) {
        onReact('celebrate', step.feedback, 'ok', 'unlock');
      } else {
        onReact('happy', `${activeDial + 1}. kilit açıldı! Sıradaki şifreye geçelim.`, 'ok', 'unlock');
        // Sonraki kilitli kadranı seç
        const nextIdx = step.dials.findIndex((_, i) => next[i] === undefined);
        if (nextIdx >= 0) {
          window.setTimeout(() => setActiveDial(nextIdx), 360);
        }
      }
      return;
    }

    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setBadOpt(optIdx);
    onReact('oops', 'Kilit dönmedi! İpucunu tekrar okuyup doğru şifreyi seç.', 'oops', 'retry');
    window.setTimeout(() => setBadOpt(null), 420);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className={`${s.vaultChamber} ${allOpen ? s.vaultChamberOpen : ''}`}>
        {/* Üst kasa başlığı ve kilit sürgüsü */}
        <div className={s.vaultHead}>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 28 28" fill="none" className="h-6 w-6 shrink-0" aria-hidden="true">
              <path
                d={allOpen ? 'M8 12V8.5a6 6 0 0 1 11.4-2.5' : 'M8 12V9a6 6 0 0 1 12 0v3'}
                stroke={allOpen ? '#4ade80' : '#fbbf24'}
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <rect
                x="5"
                y="12"
                width="18"
                height="13"
                rx="3.5"
                fill={allOpen ? '#16a34a' : '#334155'}
                stroke={allOpen ? '#86efac' : '#94a3b8'}
                strokeWidth="2"
              />
              <circle cx="14" cy="18.5" r="2.2" fill="#f8fafc" />
            </svg>
            <span className={s.vaultTitle}>{step.vaultTitle ?? 'Bilgi Kasası'}</span>
          </div>
          <span className={`${s.vaultBadge} ${allOpen ? s.vaultBadgeOpen : ''}`}>
            {allOpen ? 'AÇILDI' : `${solvedCount}/${step.dials.length} KİLİT`}
          </span>
        </div>

        {/* Kadran göstergeleri */}
        <div className={s.vaultDialsRow} role="tablist" aria-label="Kilit kadranları">
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
                    onReact('detective', d.clue, 'normal', 'tap');
                  }
                }}
                className={`${s.vaultDialSlot} ${isOpen ? s.vaultDialOpen : isCur ? s.vaultDialActive : ''}`}
              >
                <span className={s.vaultDialNum}>#{i + 1}</span>
                <span className={s.vaultDialVal}>
                  {isOpen ? d.options[lockedIn[i]] : isCur ? '•••' : 'KİLİTLİ'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Aktif ipucu paneli veya açılış kutlaması */}
        {allOpen ? (
          <div className={s.vaultOpenBanner}>
            <span className="text-sm font-black tracking-wide text-emerald-200">
              TÜM ŞİFRELER ÇÖZÜLDÜ — KAPI AÇILDI!
            </span>
          </div>
        ) : (
          dial && (
            <div className={s.vaultClueBox}>
              <div className="flex items-center justify-between gap-2">
                <span className={s.vaultClueTag}>İPUCU #{activeDial + 1}</span>
                {step.hint && !hintShown && (
                  <button
                    type="button"
                    onClick={() => {
                      setHintShown(true);
                      onReact('detective', `İpucu: ${step.hint}`, 'normal', 'tap');
                    }}
                    className={s.vaultHintBtn}
                  >
                    Atom’dan İpucu Al
                  </button>
                )}
              </div>
              <p className={s.vaultClueText}>{dial.clue}</p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {dial.options.map((opt, optIdx) => {
                  const isBad = badOpt === optIdx;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleOption(optIdx)}
                      className={`${s.vaultKeyBtn} ${isBad ? s.vaultKeyBad : ''}`}
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

      {allOpen && (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Kasayı Geç ve Devam Et →
        </button>
      )}
    </div>
  );
}
