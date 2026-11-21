'use client';

// Yazılı sayfasının ana etkileşim alanı:
//  - Öğrenci/misafir: 1) ünite/konu seç, 2) yazılı provası başlat | soruları gör
//  - Öğretmen/admin:  sorular doğrudan açık (sayfa başına 10 soru), üstte Ünite/Konu + Zorluk filtresi,
//                     her soruda tek dokunuşla Seç (otomatik hesaba kaydolur).
// Tüm sorular sunucu HTML'inde durur (SEO); aktif sayfada olmayanlar display:none ile gizlenir.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ListChecks, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { useProfileRole } from '@/app/src/hooks/useIsAdmin';
import { YaziliLiveExam, type LiveExamProps } from '@/app/src/components/yazili/YaziliLiveExam';
import { useYaziliPaperPicker } from '@/app/src/components/yazili/YaziliPaperPickerContext';
import { DIFFICULTY_BAND_LABEL, type DifficultyBand } from '@/app/src/lib/yazili/papers';
import { useDismiss } from '@/app/src/lib/useDismiss';
import r from '@/app/src/components/robotic/robotic.module.css';
import y from '@/app/src/components/yazili/yazili.module.css';

export type StudyTopic = {
  id: number;
  title: string;
  unitTitle: string;
  count: number;
  loCodes: string[];
  bandCounts: Record<DifficultyBand, number>;
};

export type StudyQuestionItem = {
  id: number;
  topicId: number;
  band: DifficultyBand;
  node: ReactNode;
};

export const YAZILI_LIST_CLASS = 'yazili-question-list';
const BANDS = Object.keys(DIFFICULTY_BAND_LABEL) as DifficultyBand[];
const PAGE_SIZE = 10;

const toggleIn = <T,>(set: Set<T>, v: T) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

type UnitGroup = { unitTitle: string; topics: StudyTopic[]; totalQuestions: number };

function groupByUnit(topics: StudyTopic[]): UnitGroup[] {
  const map = new Map<string, UnitGroup>();
  for (const t of topics) {
    const key = t.unitTitle.trim() || 'Konular';
    let group = map.get(key);
    if (!group) {
      group = { unitTitle: key, topics: [], totalQuestions: 0 };
      map.set(key, group);
    }
    group.topics.push(t);
    group.totalQuestions += t.count;
  }
  return [...map.values()];
}

function pageButtons(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('ellipsis');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('ellipsis');
  out.push(total);
  return out;
}

export function YaziliStudy({
  topics,
  items,
  exam,
}: {
  topics: StudyTopic[];
  items: StudyQuestionItem[];
  exam: LiveExamProps;
}) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const role = useProfileRole();
  const picker = useYaziliPaperPicker();
  const isTeacher = Boolean(picker?.enabled);
  // Oturum veya rol henüz çözülmediyse öğrenci kartını flash etme (authLoading dahil!).
  const waitingForRole = authLoading || (isAuthenticated && role === null);

  const [selected, setSelected] = useState<Set<number>>(() => new Set(topics.map((t) => t.id)));
  const [bands, setBands] = useState<Set<DifficultyBand>>(() => new Set(BANDS));
  const [showList, setShowList] = useState(false);
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);

  const unitGroups = useMemo(() => groupByUnit(topics), [topics]);
  const hasMultipleUnits = unitGroups.length > 1 || (unitGroups.length === 1 && unitGroups[0].unitTitle !== 'Konular');

  const loCodes = useMemo(() => [...new Set(topics.filter((t) => selected.has(t.id)).flatMap((t) => t.loCodes))], [topics, selected]);
  const filteredItems = useMemo(
    () => items.filter((it) => selected.has(it.topicId) && bands.has(it.band)),
    [items, selected, bands]
  );
  const visibleTotal = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(visibleTotal / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const endIdx = Math.min(visibleTotal, startIdx + PAGE_SIZE);
  const activeIds = useMemo(
    () => new Set(filteredItems.slice(startIdx, endIdx).map((it) => it.id)),
    [filteredItems, startIdx, endIdx]
  );

  const allSelected = selected.size === topics.length;
  const summary = [
    allSelected ? 'Tüm konular' : `${selected.size} konu`,
    bands.size < BANDS.length ? BANDS.filter((b) => bands.has(b)).map((b) => DIFFICULTY_BAND_LABEL[b]).join(', ') || 'zorluk seçilmedi' : null,
  ].filter(Boolean).join(' · ');

  const toggleTopic = (id: number) => {
    setSelected((s) => toggleIn(s, id));
    setPage(1);
  };
  const toggleBand = (b: DifficultyBand) => {
    setBands((s) => toggleIn(s, b));
    setPage(1);
  };
  const toggleAllTopics = () => {
    setSelected(allSelected ? new Set() : new Set(topics.map((t) => t.id)));
    setPage(1);
  };
  const toggleUnit = (group: UnitGroup) => {
    const allInUnit = group.topics.every((t) => selected.has(t.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of group.topics) {
        if (allInUnit) next.delete(t.id);
        else next.add(t.id);
      }
      return next;
    });
    setPage(1);
  };
  const openList = () => {
    setShowList(true);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const goToPage = (next: number) => {
    const clamped = Math.max(1, Math.min(totalPages, next));
    setPage(clamped);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const listVisible = !waitingForRole && (isTeacher || showList);

  return (
    <>
      {waitingForRole ? (
        <div aria-busy="true" aria-label="Sayfa hazırlanıyor" className={`h-44 animate-pulse rounded-2xl ${r.panel}`} />
      ) : !isTeacher ? (
        <section aria-labelledby="calis-baslik" className={`p-5 sm:p-6 ${r.panel}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="calis-baslik" className="flex items-center gap-2 text-base font-bold text-default">
              <span className={`h-7 w-7 shrink-0 text-xs ${r.chipBox}`} aria-hidden="true">1</span>
              Hangi konulara çalışacaksın?
            </h2>
            <button
              type="button"
              onClick={toggleAllTopics}
              className={`shrink-0 text-sm font-semibold ${r.accent} hover:underline`}
            >
              {allSelected ? 'Temizle' : 'Tümünü seç'}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {unitGroups.map((group) => {
              const checkedCount = group.topics.filter((t) => selected.has(t.id)).length;
              const unitAll = checkedCount === group.topics.length;
              const unitSome = checkedCount > 0 && !unitAll;
              return (
                <div key={group.unitTitle} className={hasMultipleUnits ? `rounded-2xl border p-2.5 sm:p-3 ${r.divider}` : ''}>
                  {hasMultipleUnits && (
                    <label className="mb-1.5 flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 hover:bg-[color-mix(in_srgb,var(--neon)_6%,transparent)]">
                      <input
                        type="checkbox"
                        checked={unitAll}
                        ref={(el) => {
                          if (el) el.indeterminate = unitSome;
                        }}
                        onChange={() => toggleUnit(group)}
                        className="h-4 w-4 shrink-0 accent-[var(--neon)]"
                      />
                      <span className={`min-w-0 flex-1 text-xs font-bold uppercase tracking-wide ${r.accent}`}>
                        {group.unitTitle}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{group.totalQuestions} soru</span>
                    </label>
                  )}
                  <ul className="flex flex-col gap-1.5">
                    {group.topics.map((t) => (
                      <li key={t.id}>
                        <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${r.item} ${r.itemHover}`}>
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggleTopic(t.id)}
                            className="h-4 w-4 shrink-0 accent-[var(--neon)]"
                          />
                          <span className="min-w-0 flex-1 text-sm font-medium text-default">{t.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{t.count} soru</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

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
      ) : null}

      <div ref={listRef} className={`${YAZILI_LIST_CLASS} scroll-mt-[120px] lg:scroll-mt-[80px]`} style={listVisible ? undefined : { display: 'none' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <p className="min-w-0 text-sm">
            <b className="text-default">
              {visibleTotal > 0 ? `${startIdx + 1}–${endIdx} / ${visibleTotal} soru` : '0 soru'}
            </b>
            <span className="text-muted-foreground"> · {summary}</span>
          </p>
          <FilterMenu
            unitGroups={unitGroups}
            hasMultipleUnits={hasMultipleUnits}
            selected={selected}
            allSelected={allSelected}
            onToggleAll={toggleAllTopics}
            onToggleUnit={toggleUnit}
            onToggleTopic={toggleTopic}
            bands={bands}
            onToggleBand={toggleBand}
          />
        </div>

        <ol
          className={`mt-2 flex flex-col gap-3 ${y.poolList}`}
          style={{ counterReset: `soru ${startIdx}` }}
        >
          {items.map((it) => (
            <li
              key={it.id}
              data-zorluk={it.band}
              style={activeIds.has(it.id) ? undefined : { display: 'none' }}
            >
              {it.node}
            </li>
          ))}
        </ol>

        {visibleTotal === 0 && (
          <p className={`mt-3 rounded-xl p-4 text-sm text-muted-foreground ${r.item}`}>
            Bu seçimde soru yok. Ünite / Konu filtresinden konu ya da zorluk ekle.
          </p>
        )}

        {totalPages > 1 && (
          <nav aria-label="Soru sayfaları" className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
              className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold disabled:pointer-events-none disabled:opacity-40 ${r.btnGhost}`}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Önceki
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1">
              {pageButtons(safePage, totalPages).map((entry, idx) =>
                entry === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1.5 text-sm text-muted-foreground" aria-hidden="true">…</span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => goToPage(entry)}
                    aria-current={entry === safePage ? 'page' : undefined}
                    className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-bold ${
                      entry === safePage ? `${r.btnNeon} ${r.btnText} text-white` : r.btnGhost
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages}
              className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold disabled:pointer-events-none disabled:opacity-40 ${r.btnGhost}`}
            >
              Sonraki <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </>
  );
}

// Filtre düğmesi: zorluk + ünite/konu çoklu seçimi.
function FilterMenu({
  unitGroups,
  hasMultipleUnits,
  selected,
  allSelected,
  onToggleAll,
  onToggleUnit,
  onToggleTopic,
  bands,
  onToggleBand,
}: {
  unitGroups: UnitGroup[];
  hasMultipleUnits: boolean;
  selected: Set<number>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleUnit: (group: UnitGroup) => void;
  onToggleTopic: (id: number) => void;
  bands: Set<DifficultyBand>;
  onToggleBand: (b: DifficultyBand) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const box = 'h-4 w-4 shrink-0 accent-[var(--neon)]';
  const row = 'flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-default hover:bg-[color-mix(in_srgb,var(--neon)_8%,transparent)]';

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold ${r.btnGhost}`}>
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Ünite / Konu
      </button>
      {open && (
        <div role="dialog" aria-label="Soruları süz" className={`absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] p-3 ${r.menu}`}>
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
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p id="filtre-konu" className={r.label}>Ünite ve Konu</p>
              <button type="button" onClick={onToggleAll} className={`text-xs font-semibold ${r.accent} hover:underline`}>
                {allSelected ? 'Temizle' : 'Tümünü seç'}
              </button>
            </div>
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {unitGroups.map((group) => {
                const checkedCount = group.topics.filter((t) => selected.has(t.id)).length;
                const unitAll = checkedCount === group.topics.length;
                const unitSome = checkedCount > 0 && !unitAll;
                return (
                  <div key={group.unitTitle}>
                    {hasMultipleUnits && (
                      <label className={`${row} font-semibold`}>
                        <input
                          type="checkbox"
                          className={box}
                          checked={unitAll}
                          ref={(el) => {
                            if (el) el.indeterminate = unitSome;
                          }}
                          onChange={() => onToggleUnit(group)}
                        />
                        <span className={`min-w-0 flex-1 text-xs uppercase ${r.accent}`}>{group.unitTitle}</span>
                      </label>
                    )}
                    <div className={hasMultipleUnits ? 'pl-4' : ''}>
                      {group.topics.map((t) => (
                        <label key={t.id} className={row}>
                          <input type="checkbox" className={box} checked={selected.has(t.id)} onChange={() => onToggleTopic(t.id)} />
                          <span className="min-w-0 flex-1">{t.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
