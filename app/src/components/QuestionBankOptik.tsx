'use client';

// Soru bankası konu sayfasının "optik" soru haritası (2026-10-04, kullanıcı isteği — v1'deki
// optiğin yeni liste görünümüne uyarlanmışı). Renk bu sayfadaki cevaba (öğrencide son cevabına)
// göre; numaraya tıklayınca o soruya kaydırır (gizliyse liste açılır).
//  - Masaüstü (lg+): OptikRail — soru listesinin SOLUNDA tek sütun (her satırda bir soru),
//    ekran yüksekliğinde yapışkan. Kaydırmayı takip eder: ekrandaki sorular vurgulanır, ekranın
//    ortasındaki soru sütunun da ortasında tutulur (kullanıcı tasarımı; önceki sağ sütun optiği
//    gezinme kartlarının üstüne biniyordu).
//  - Mobil: QuestionBankOptik — sağ altta yüzen düğme → alttan açılan sayfa (ızgara).
// Yalnız tarayıcı davranışı; SEO içeriği değildir.
import { useEffect, useRef, useState } from 'react';
import { Grid3x3, X } from 'lucide-react';

export type OptikStatus = 'correct' | 'incorrect' | 'revealed' | undefined;

type OptikItem = { id: number; number: number };

function statusLabel(status: OptikStatus): string {
  return status === 'correct' ? 'doğru' : status === 'incorrect' ? 'yanlış' : status === 'revealed' ? 'cevabı görüldü' : 'çözülmedi';
}

function statusTone(status: OptikStatus): string {
  return status === 'correct'
    ? 'border-emerald-500 bg-emerald-500 text-white'
    : status === 'incorrect'
      ? 'border-rose-500 bg-rose-500 text-white'
      : status === 'revealed'
        ? 'border-indigo-300 bg-indigo-500/15 text-indigo-700 dark:border-indigo-400/50 dark:text-indigo-300'
        : 'border-default bg-background text-muted-foreground hover:border-indigo-300 hover:text-default';
}

// Ekranda görünen soruların id'leri + ekran ortasındaki soru. Kaydırmada rAF ile, yeniden
// render yalnız değer değişince. Gizli (display:none) kartların yüksekliği 0 → sayılmaz.
function useViewportQuestions(itemIds: number[]) {
  const [state, setState] = useState<{ centerId: number | null; inView: Set<number> }>({ centerId: null, inView: new Set() });
  const idsKey = itemIds.join(',');

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      const inView = new Set<number>();
      let centerId: number | null = null;
      let best = Infinity;
      for (const id of ids) {
        const el = document.getElementById(`soru-${id}`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) continue;
        inView.add(id);
        const distance = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (distance < best) {
          best = distance;
          centerId = id;
        }
      }
      setState((prev) => {
        const same = prev.centerId === centerId && prev.inView.size === inView.size && [...inView].every((id) => prev.inView.has(id));
        return same ? prev : { centerId, inView };
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // "Sonraki 10 soru", filtre, görseller → kart yükseklikleri değişir.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [idsKey]);

  return state;
}

export function OptikRail({ items, statusOf, onJump }: { items: OptikItem[]; statusOf: (id: number) => OptikStatus; onJump: (id: number) => void }) {
  const railRef = useRef<HTMLOListElement>(null);
  const { centerId, inView } = useViewportQuestions(items.map((i) => i.id));

  // Ortadaki sorunun numarası sütunun ortasında dursun (sütun kendi içinde kayar; sayfayı kaydırmaz).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || centerId == null) return;
    const btn = rail.querySelector<HTMLElement>(`[data-optik-id="${centerId}"]`);
    if (!btn) return;
    const target = btn.offsetTop - rail.clientHeight / 2 + btn.offsetHeight / 2;
    rail.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [centerId]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Optik form" className="sticky top-[88px] hidden lg:block">
      <ol ref={railRef} className="relative flex max-h-[calc(100vh-104px)] flex-col gap-1 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ id, number }) => {
          const status = statusOf(id);
          const isCenter = id === centerId;
          const visible = inView.has(id);
          return (
            <li key={id} className="px-1">
              <button
                type="button"
                data-optik-id={id}
                onClick={() => onJump(id)}
                aria-label={`Soru ${number}, ${statusLabel(status)}`}
                aria-current={isCenter ? 'true' : undefined}
                className={`flex h-8 w-full items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors ${statusTone(status)} ${
                  isCenter ? 'ring-2 ring-indigo-500' : visible && !status ? 'border-indigo-300 text-default dark:border-indigo-400/60' : ''
                }`}
              >
                {number}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function QuestionBankOptik({
  items,
  statusOf,
  onJump,
  answeredCount,
}: {
  items: OptikItem[];
  statusOf: (id: number) => OptikStatus;
  onJump: (id: number) => void;
  answeredCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sheetOpen]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label="Optik formu aç"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 lg:hidden"
      >
        <Grid3x3 className="h-4 w-4" aria-hidden="true" /> {answeredCount}/{items.length}
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50 lg:hidden" onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Optik form"
            className="max-h-[75vh] w-full overflow-y-auto rounded-t-3xl border-t border-default bg-background p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-default">
                Optik form <span className="ml-1 font-normal text-muted-foreground tabular-nums">{answeredCount}/{items.length} çözüldü</span>
              </h2>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Kapat" className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="grid grid-cols-6 gap-1.5">
              {items.map(({ id, number }) => {
                const status = statusOf(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetOpen(false);
                        onJump(id);
                      }}
                      aria-label={`Soru ${number}, ${statusLabel(status)}`}
                      className={`flex h-10 w-full items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors ${statusTone(status)}`}
                    >
                      {number}
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /> Doğru</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" aria-hidden="true" /> Yanlış</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-default" aria-hidden="true" /> Çözülmedi</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
