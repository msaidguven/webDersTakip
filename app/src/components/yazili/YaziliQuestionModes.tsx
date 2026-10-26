'use client';

// Yazılı sayfasının soru alanı (2026-10-26): deneme kağıdı ile konu havuzu aynı soruları alt alta iki kez
// göstermesin diye tek alanda iki sekme. İkisi de sunucu HTML'inde durur (SEO); seçili olmayan yalnız
// display:none, JS kapalıysa sayfadaki <noscript> stili ikisini de açar. "#konu-<id>" bağlantıları
// YaziliTopicTabs içinden useShowYaziliPool ile "Konu konu" sekmesine geçirir.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import r from '@/app/src/components/robotic/robotic.module.css';

export const YAZILI_MODE_PANEL_CLASS = 'yazili-mode-panel';

const ShowPoolContext = createContext<(() => void) | null>(null);
export const useShowYaziliPool = () => useContext(ShowPoolContext);

type ModeContent = { count: number; content: ReactNode };

export function YaziliQuestionModes({ practice, pool }: { practice: ModeContent | null; pool: ModeContent }) {
  const [mode, setMode] = useState<'practice' | 'pool'>(practice ? 'practice' : 'pool');
  const showPool = useCallback(() => setMode('pool'), []);

  const modes = [
    ...(practice ? [{ key: 'practice' as const, label: 'Sınav provası', ...practice }] : []),
    { key: 'pool' as const, label: 'Konu konu sorular', ...pool },
  ];

  return (
    <ShowPoolContext.Provider value={showPool}>
      <div className="flex flex-col gap-4">
        {modes.length > 1 && (
          <div role="tablist" aria-label="Soru görünümü" className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)] p-1 shadow-sm">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                id={`soru-gorunum-${m.key}`}
                aria-selected={mode === m.key}
                aria-controls={`soru-gorunum-panel-${m.key}`}
                onClick={() => setMode(m.key)}
                className={`${r.tab} ${mode === m.key ? r.tabActive : ''} flex min-h-11 flex-col items-center justify-center sm:flex-row sm:gap-2`}
              >
                {m.label}
                <span className="text-[10px] opacity-70">{m.count} soru</span>
              </button>
            ))}
          </div>
        )}
        {modes.map((m) => (
          <div
            key={m.key}
            id={`soru-gorunum-panel-${m.key}`}
            role={modes.length > 1 ? 'tabpanel' : undefined}
            aria-labelledby={modes.length > 1 ? `soru-gorunum-${m.key}` : undefined}
            className={YAZILI_MODE_PANEL_CLASS}
            style={mode === m.key ? undefined : { display: 'none' }}
          >
            {m.content}
          </div>
        ))}
      </div>
    </ShowPoolContext.Provider>
  );
}
