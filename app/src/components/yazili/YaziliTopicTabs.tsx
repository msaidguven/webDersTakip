'use client';

// Yazılının konu konu soru havuzu (2026-10-25): üstte yapışkan konu sekmeleri, ekranda tek konu.
// Bütün konuların soruları sunucu HTML'inde durur (SEO); seçili olmayanlar yalnız display:none —
// soru bankasındaki QuestionBankBoard ile aynı yöntem, JS kapalıysa sayfadaki <noscript> stili hepsini açar.
// "#konu-<id>" bağlantıları (yan menü) ilgili sekmeyi açıp oraya kaydırır.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useShowYaziliPool } from '@/app/src/components/yazili/YaziliQuestionModes';
import r from '@/app/src/components/robotic/robotic.module.css';

export type YaziliTopicTab = { id: number; label: string; count: number };

export const YAZILI_TOPIC_PANEL_CLASS = 'yazili-topic-panel';

export function YaziliTopicTabs({ tabs, panels }: { tabs: YaziliTopicTab[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  // Havuz "Sınav provası" sekmesinin arkasında gizliyse önce onu aç (gizli çubuğa kaydırılamaz).
  const showPool = useShowYaziliPool();

  const scrollToBar = useCallback(() => {
    barRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const i = tabs.findIndex((t) => window.location.hash === `#konu-${t.id}`);
      if (i === -1) return;
      showPool?.();
      setActive(i);
      requestAnimationFrame(scrollToBar);
    };
    // Yan menü bağlantıları next/link: hash'i history API ile değiştirdiği için hashchange tetiklenmiyor —
    // "#konu-" bağlantılarına tıklamayı burada yakalıyoruz (orta tık/yeni sekme tarayıcıya kalır).
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = (e.target as Element | null)?.closest('a')?.getAttribute('href');
      const i = href ? tabs.findIndex((t) => href === `#konu-${t.id}`) : -1;
      if (i === -1) return;
      e.preventDefault();
      window.history.replaceState(window.history.state, '', href);
      showPool?.();
      setActive(i);
      requestAnimationFrame(scrollToBar);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      document.removeEventListener('click', onClick, true);
    };
  }, [tabs, scrollToBar, showPool]);

  const select = (i: number, scroll: boolean) => {
    setActive(i);
    if (scroll) requestAnimationFrame(scrollToBar);
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={barRef} className="sticky top-[60px] z-20 -mx-4 scroll-mt-[60px] bg-[color:var(--bg)] px-4 py-2 sm:top-[72px] sm:mx-0 sm:scroll-mt-[72px] sm:px-0">
        <div
          role="tablist"
          aria-label="Konular"
          className="flex gap-1 overflow-x-auto rounded-xl sm:flex-wrap sm:overflow-x-visible border border-[var(--edge)] bg-[var(--panel-solid)] p-1 shadow-sm [scrollbar-width:thin]"
        >
          {tabs.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`konu-sekme-${t.id}`}
              aria-selected={i === active}
              aria-controls={`konu-panel-${t.id}`}
              onClick={() => select(i, false)}
              className={`${r.tab} ${i === active ? r.tabActive : ''} flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs`}
            >
              {t.label}
              <span className="text-[10px] opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {panels.map((panel, i) => (
        <div
          key={tabs[i].id}
          id={`konu-panel-${tabs[i].id}`}
          role="tabpanel"
          aria-labelledby={`konu-sekme-${tabs[i].id}`}
          className={YAZILI_TOPIC_PANEL_CLASS}
          style={i === active ? undefined : { display: 'none' }}
        >
          {panel}
          {i < tabs.length - 1 && (
            <button
              type="button"
              onClick={() => select(i + 1, true)}
              className={`mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-4 text-sm font-bold ${r.btnGhost}`}
            >
              Sıradaki konu: {tabs[i + 1].label} →
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
