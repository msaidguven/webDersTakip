'use client';

// Yazılı sayfasının öğrenci alanı (2026-11-01, kullanıcı: "sayfa çok karışık, ekranda kalabalık istemiyorum"):
// tek ekranda iki adım — 1) hangi konular (çoklu seçim, hepsi seçili gelir), 2) yazılı provası çöz | soruları gör.
// Eski prova/havuz sekmeleri, konu sekmeleri ve hazır deneme kağıtları kaldırıldı.
// Sorular sunucu HTML'inde durur (SEO), "Soruları gör"e basılana kadar display:none; JS kapalıysa sayfadaki
// <noscript> stili açar. Zorluk süzmesi CSS ile (yazili.module.css), görünen sorular 1'den numaralanır.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ListChecks, SlidersHorizontal } from 'lucide-react';
import { YaziliLiveExam, type LiveExamProps } from '@/app/src/components/yazili/YaziliLiveExam';
import { DIFFICULTY_BAND_LABEL, type DifficultyBand } from '@/app/src/lib/yazili/papers';
import { useDismiss } from '@/app/src/lib/useDismiss';
import r from '@/app/src/components/robotic/robotic.module.css';
import y from '@/app/src/components/yazili/yazili.module.css';

export type StudyTopic = { id: number; title: string; count: number; loCodes: string[]; bandCounts: Record<DifficultyBand, number> };

export const YAZILI_LIST_CLASS = 'yazili-question-list';
const BANDS = Object.keys(DIFFICULTY_BAND_LABEL) as DifficultyBand[];

const toggleIn = <T,>(set: Set<T>, v: T) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

export function YaziliStudy({ topics, panels, exam }: { topics: StudyTopic[]; panels: ReactNode[]; exam: LiveExamProps }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(topics.map((t) => t.id)));
  const [bands, setBands] = useState<Set<DifficultyBand>>(() => new Set(BANDS));
  const [showList, setShowList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loCodes = useMemo(() => [...new Set(topics.filter((t) => selected.has(t.id)).flatMap((t) => t.loCodes))], [topics, selected]);
  const visibleOf = (t: StudyTopic) => (selected.has(t.id) ? BANDS.reduce((n, b) => n + (bands.has(b) ? t.bandCounts[b] : 0), 0) : 0);
  const visibleTotal = topics.reduce((n, t) => n + visibleOf(t), 0);
  const allSelected = selected.size === topics.length;
  const summary = [
    allSelected ? 'Tüm konular' : `${selected.size} konu`,
    bands.size < BANDS.length ? BANDS.filter((b) => bands.has(b)).map((b) => DIFFICULTY_BAND_LABEL[b]).join(', ') || 'zorluk seçilmedi' : null,
  ].filter(Boolean).join(' · ');

  const toggleTopic = (id: number) => setSelected((s) => toggleIn(s, id));
  const openList = () => {
    setShowList(true);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <>
      <section aria-labelledby="calis-baslik" className={`p-5 sm:p-6 ${r.panel}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="calis-baslik" className="flex items-center gap-2 text-base font-bold text-default">
            <span className={`h-7 w-7 shrink-0 text-xs ${r.chipBox}`} aria-hidden="true">1</span>
            Hangi konulara çalışacaksın?
          </h2>
          <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(topics.map((t) => t.id)))} className={`shrink-0 text-sm font-semibold ${r.accent} hover:underline`}>
            {allSelected ? 'Temizle' : 'Tümünü seç'}
          </button>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {topics.map((t) => (
            <li key={t.id}>
              <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${r.item} ${r.itemHover}`}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTopic(t.id)} className="h-4 w-4 shrink-0 accent-[var(--neon)]" />
                <span className="min-w-0 flex-1 text-sm font-medium text-default">{t.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.count} soru</span>
              </label>
            </li>
          ))}
        </ul>

        <h2 className="mt-6 flex items-center gap-2 text-base font-bold text-default">
          <span className={`h-7 w-7 shrink-0 text-xs ${r.chipBox}`} aria-hidden="true">2</span>
          Nasıl çalışmak istersin?
        </h2>
        <div className="mt-3">
          {selected.size === 0 ? (
            <p className="text-sm text-muted-foreground">Başlamak için en az bir konu seç.</p>
          ) : (
            <YaziliLiveExam
              {...exam}
              loCodes={loCodes}
              secondary={
                <button type="button" onClick={openList} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold ${r.btnGhost}`}>
                  <ListChecks className="h-4 w-4" aria-hidden="true" /> Soruları gör
                </button>
              }
            />
          )}
        </div>
      </section>

      <div ref={listRef} className={`${YAZILI_LIST_CLASS} scroll-mt-[64px] sm:scroll-mt-[76px]`} style={showList ? undefined : { display: 'none' }}>
        <div className="sticky top-[60px] z-20 -mx-4 flex items-center justify-between gap-3 bg-[color:var(--bg)] px-4 py-2 sm:top-[72px] sm:mx-0 sm:px-0">
          <p className="min-w-0 text-sm">
            <b className="text-default">{visibleTotal} soru</b>
            <span className="text-muted-foreground"> · {summary}</span>
          </p>
          <FilterMenu topics={topics} selected={selected} onToggleTopic={toggleTopic} bands={bands} onToggleBand={(b) => setBands((s) => toggleIn(s, b))} />
        </div>
        <div
          className={`mt-2 flex flex-col gap-6 ${y.poolList} ${y.filtered}`}
          data-gizle-kolay={bands.has('kolay') ? undefined : ''}
          data-gizle-orta={bands.has('orta') ? undefined : ''}
          data-gizle-zor={bands.has('zor') ? undefined : ''}
        >
          {topics.map((t, i) => (
            <section key={t.id} id={`konu-${t.id}`} aria-labelledby={`konu-baslik-${t.id}`} className="flex flex-col gap-3" style={visibleOf(t) ? undefined : { display: 'none' }}>
              <h3 id={`konu-baslik-${t.id}`} className={`text-base font-bold uppercase text-default ${r.display}`}>
                {t.title}
                <span className="ml-2 align-middle text-sm font-semibold normal-case text-muted-foreground">{visibleOf(t)} soru</span>
              </h3>
              {panels[i]}
            </section>
          ))}
          {visibleTotal === 0 && (
            <p className={`rounded-xl p-4 text-sm text-muted-foreground ${r.item}`}>Bu seçimde soru yok. Filtreden konu ya da zorluk ekle.</p>
          )}
        </div>
      </div>
    </>
  );
}

// Filtre düğmesi: konu ve zorluk, ikisi de çoklu seçim. Konu seçimi 1. adımla aynı.
function FilterMenu({ topics, selected, onToggleTopic, bands, onToggleBand }: {
  topics: StudyTopic[]; selected: Set<number>; onToggleTopic: (id: number) => void;
  bands: Set<DifficultyBand>; onToggleBand: (b: DifficultyBand) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const box = 'h-4 w-4 shrink-0 accent-[var(--neon)]';
  const row = 'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-default hover:bg-[color-mix(in_srgb,var(--neon)_8%,transparent)]';

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${r.btnGhost}`}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtre
      </button>
      {open && (
        <div role="dialog" aria-label="Soruları süz" className={`absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-3 ${r.menu}`}>
          <div role="group" aria-labelledby="filtre-zorluk">
            <p id="filtre-zorluk" className={`mb-1 ${r.label}`}>Zorluk</p>
            <div className="flex flex-wrap gap-x-2">
              {BANDS.map((b) => (
                <label key={b} className={row}>
                  <input type="checkbox" className={box} checked={bands.has(b)} onChange={() => onToggleBand(b)} />
                  {DIFFICULTY_BAND_LABEL[b]}
                </label>
              ))}
            </div>
          </div>
          <div role="group" aria-labelledby="filtre-konu" className="mt-3 border-t border-[var(--edge)] pt-3">
            <p id="filtre-konu" className={`mb-1 ${r.label}`}>Konu</p>
            <div className="flex max-h-64 flex-col overflow-y-auto">
              {topics.map((t) => (
                <label key={t.id} className={row}>
                  <input type="checkbox" className={box} checked={selected.has(t.id)} onChange={() => onToggleTopic(t.id)} />
                  <span className="min-w-0 flex-1">{t.title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
