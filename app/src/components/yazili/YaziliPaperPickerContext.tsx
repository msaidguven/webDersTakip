'use client';

// Yazılı sayfasında öğretmen/admin için tek dokunuşla soru seçme, hesaba otomatik kaydetme
// (telefonda seç → PC'de aç), seçilenleri tek listede görme ve doğrudan Word (.docx) indirme.
// Öğrenci ve misafirlerde hiçbir ek UI çizmez; sunucu HTML'i (SEO/ISR) etkilenmez.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, CloudCheck, Eye, FileText, Loader2, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useIsTeacherOrAdmin } from '@/app/src/components/yazili/YaziliTeacherSection';
import MathText from '@/app/src/components/MathText';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import r from '@/app/src/components/robotic/robotic.module.css';

function YaziliPickerDrawerBackGuard({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDismissOnBack(open, onClose);
  return null;
}

export type QuestionSummary = { id: number; text: string; topicTitle: string };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PickerContextValue {
  enabled: boolean;
  loadingDraft: boolean;
  selectedIds: number[];
  selectedSet: Set<number>;
  saveState: SaveState;
  downloading: boolean;
  error: string | null;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleQuestion: (id: number) => void;
  removeQuestion: (id: number) => void;
  clearAll: () => void;
  downloadWord: () => Promise<void>;
  examId: number;
}

const PickerContext = createContext<PickerContextValue | null>(null);

function equalPoints(n: number): number[] {
  if (!n) return [];
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - rem ? 1 : 0));
}

export function useYaziliPaperPicker() {
  return useContext(PickerContext);
}

export function YaziliPaperPickerProvider({
  examId,
  examTitle,
  questions,
  children,
}: {
  examId: number;
  examTitle: string;
  questions: QuestionSummary[];
  children: ReactNode;
}) {
  const enabled = useIsTeacherOrAdmin();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [draftTitle, setDraftTitle] = useState<string>(examTitle);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const validIds = useMemo(() => new Set(questions.map((q) => q.id)), [questions]);
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const hydratedRef = useRef(false);
  const dirtyRef = useRef(false);

  // Öğretmen/admin oturumu açıldığında daha önce (telefondan veya PC'den) kaydedilen taslağı çek.
  useEffect(() => {
    if (!enabled) {
      hydratedRef.current = false;
      dirtyRef.current = false;
      return;
    }
    let cancelled = false;
    setLoadingDraft(true);
    fetch(`/api/ogretmen/yazili/taslak?examId=${examId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { draft?: { items?: { id: number }[]; title?: string } | null } | null) => {
        if (cancelled) return;
        const ids = Array.isArray(data?.draft?.items)
          ? data!.draft!.items!.map((i) => Number(i.id)).filter((id) => validIds.has(id))
          : [];
        setSelectedIds(ids);
        if (data?.draft?.title) setDraftTitle(data.draft.title);
        if (ids.length > 0) setSaveState('saved');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          hydratedRef.current = true;
          setLoadingDraft(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, examId, validIds]);

  // Her seçim değişikliğinde otomatik olarak hesaba kaydet (500ms bekletmeli).
  useEffect(() => {
    if (!enabled || !hydratedRef.current || !dirtyRef.current) return;
    setSaveState('saving');
    const timer = setTimeout(() => {
      const pts = equalPoints(selectedIds.length);
      const items = selectedIds.map((id, i) => ({ id, points: pts[i] ?? 0 }));
      fetch('/api/ogretmen/yazili/taslak', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, items, autoPoints: true, title: draftTitle }),
        keepalive: true,
      })
        .then((res) => setSaveState(res.ok ? 'saved' : 'error'))
        .catch(() => setSaveState('error'));
    }, 500);
    return () => clearTimeout(timer);
  }, [enabled, examId, selectedIds, draftTitle]);

  const toggleQuestion = useCallback((id: number) => {
    dirtyRef.current = true;
    setError(null);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const removeQuestion = useCallback((id: number) => {
    dirtyRef.current = true;
    setError(null);
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearAll = useCallback(() => {
    dirtyRef.current = true;
    setError(null);
    setSelectedIds([]);
  }, []);

  const downloadWord = useCallback(async () => {
    if (!selectedIds.length || downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const pts = equalPoints(selectedIds.length);
      const items = selectedIds.map((id, i) => ({ id, points: pts[i] ?? 0 }));
      const res = await fetch('/api/ogretmen/yazili/word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, items, title: draftTitle, columns: 1 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Word dosyası indirilemedi');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="([^"]+)"/);
      const fileName = match?.[1] || 'yazili-kagidi.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Word dosyası indirilemedi');
    } finally {
      setDownloading(false);
    }
  }, [selectedIds, downloading, examId, draftTitle]);

  const value = useMemo<PickerContextValue>(
    () => ({
      enabled,
      loadingDraft,
      selectedIds,
      selectedSet,
      saveState,
      downloading,
      error,
      drawerOpen,
      setDrawerOpen,
      toggleQuestion,
      removeQuestion,
      clearAll,
      downloadWord,
      examId,
    }),
    [enabled, loadingDraft, selectedIds, selectedSet, saveState, downloading, error, drawerOpen, toggleQuestion, removeQuestion, clearAll, downloadWord, examId]
  );

  return (
    <PickerContext.Provider value={value}>
      {children}

      {/* Öğretmen sabit alt araç çubuğu: en az 1 soru seçildiğinde hem mobilde hem PC'de el altında */}
      {enabled && selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Seçilen yazılı soruları"
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-2xl lg:bottom-5"
        >
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 shadow-2xl ${r.panel} ${r.neonBorder}`}>
            <div className="flex min-w-0 items-center gap-2.5 pl-1">
              <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-2 text-sm font-extrabold ${r.chipBox}`}>
                {selectedIds.length}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-default">{selectedIds.length} soru seçildi</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  {saveState === 'saving' ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Hesaba kaydediliyor…
                    </>
                  ) : saveState === 'error' ? (
                    <span className="text-rose-500">Kaydedilemedi, tekrar denenecek</span>
                  ) : (
                    <>
                      <CloudCheck className="h-3 w-3 text-emerald-500" aria-hidden="true" /> Hesabında kayıtlı
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold sm:text-sm ${r.btnGhost}`}
              >
                <Eye className="h-4 w-4" aria-hidden="true" /> Seçilenler
              </button>
              <button
                type="button"
                onClick={() => void downloadWord()}
                disabled={downloading}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white sm:text-sm ${r.btnNeon} ${r.btnText}`}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                Word indir
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-1.5 rounded-xl bg-rose-500/95 px-3 py-1.5 text-center text-xs font-semibold text-white shadow">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Seçilen Sorular Çekmecesi / Modalı */}
      <YaziliPickerDrawerBackGuard open={Boolean(enabled && drawerOpen)} onClose={() => setDrawerOpen(false)} />
      {enabled && drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="secilen-sorular-baslik"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className={`flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${r.panel}`}>
            <header className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${r.divider}`}>
              <div>
                <h2 id="secilen-sorular-baslik" className={`text-base font-bold uppercase text-default sm:text-lg ${r.display}`}>
                  Seçtiğin sorular ({selectedIds.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Hesabında otomatik saklanır — telefonda seçip bilgisayardan indirip yazdırabilirsin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Kapat"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${r.iconBtn}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {selectedIds.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Henüz soru seçmedin.</p>
              ) : (
                <ol className="flex flex-col gap-2.5">
                  {selectedIds.map((id, idx) => {
                    const q = questionById.get(id);
                    if (!q) return null;
                    return (
                      <li key={id} className={`flex items-start gap-3 rounded-2xl p-3.5 ${r.item}`}>
                        <span className={`h-7 w-7 shrink-0 text-xs ${r.chipBox}`}>{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold text-muted-foreground">{q.topicTitle}</span>
                          <p className="mt-0.5 line-clamp-3 text-sm leading-relaxed text-default">
                            <MathText text={q.text} />
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQuestion(id)}
                          aria-label={`${idx + 1}. soruyu çıkar`}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <footer className={`flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5 ${r.divider}`}>
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs font-semibold text-muted-foreground hover:text-rose-500"
                  >
                    Tümünü temizle
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/ogretmen/yazili?yazili=${examId}`}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold sm:text-sm ${r.btnGhost}`}
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Ayrıntılı düzenle / PDF
                </Link>
                <button
                  type="button"
                  onClick={() => void downloadWord()}
                  disabled={!selectedIds.length || downloading}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white sm:text-sm ${r.btnNeon} ${r.btnText}`}
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                  Word indir (.docx)
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </PickerContext.Provider>
  );
}

// Her soru kartının sağ üstünde (yalnız öğretmen/admin için) tek dokunuşla ekle/çıkar düğmesi.
export function YaziliPickButton({ questionId }: { questionId: number }) {
  const ctx = useYaziliPaperPicker();
  if (!ctx?.enabled) return null;
  const picked = ctx.selectedSet.has(questionId);
  return (
    <button
      type="button"
      onClick={() => ctx.toggleQuestion(questionId)}
      aria-pressed={picked}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-colors ${
        picked ? `${r.btnNeon} ${r.btnText} text-white` : r.btnGhost
      }`}
    >
      {picked ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Seçildi
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Seç
        </>
      )}
    </button>
  );
}
