'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { MatrixLessonCol, MatrixLessonVersion, MatrixTopicCell } from '@/app/api/admin/etkilesimli-ders/matris/route';

type MatrixResponse = {
  grades: { id: number; name: string }[];
  selectedGradeId: number | null;
  lessons: MatrixLessonCol[];
  weeks: number[];
  cells: Record<string, MatrixTopicCell[]>;
  summary: {
    totalTopics: number;
    v32: number;
    v31: number;
    v30: number;
    v2: number;
    v1: number;
    inProgress: number;
    none: number;
  };
};

type WeekFilter = 'active' | 'term1' | 'all';

function badgeStyle(cell: MatrixTopicCell): { label: string; cls: string } {
  if (cell.status && cell.status !== 'ready') {
    if (cell.status === 'failed') {
      return { label: 'Hata', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' };
    }
    return { label: 'Üretim', cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' };
  }
  if (cell.status === 'ready' && !cell.voiceDone) {
    return { label: 'Ses', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' };
  }
  const v: MatrixLessonVersion = cell.version;
  if (v === '3.2') return { label: 'v3.2', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 font-black' };
  if (v === '3.1') return { label: 'v3.1', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35' };
  if (v === '3.0') return { label: 'v3.0', cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/35' };
  if (v === '2') return { label: 'v2', cls: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/35' };
  if (v === '1') return { label: 'v1', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35' };
  return { label: 'Yok', cls: 'bg-muted text-muted-foreground border-border' };
}

export default function InteractiveLessonMatrixTab() {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>('term1');
  const [onlyNonV32, setOnlyNonV32] = useState(false);

  const selectGrade = useCallback((id: number) => {
    setLoading(true);
    setError(null);
    setGradeId(id);
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const qs = gradeId ? `?gradeId=${gradeId}` : '';
    fetch(`/api/admin/etkilesimli-ders/matris${qs}`, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json()) as MatrixResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        setData(json);
        setError(null);
        if (gradeId === null && json.selectedGradeId) setGradeId(json.selectedGradeId);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : 'Veri yüklenemedi');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [gradeId, refreshTick]);

  const visibleWeeks = useMemo(() => {
    if (!data) return [];
    const base = data.weeks.filter((w) => {
      if (weekFilter === 'active') return w <= 11;
      if (weekFilter === 'term1') return w <= 18;
      return true;
    });
    if (!onlyNonV32) return base;
    return base.filter((w) =>
      data.lessons.some((l) => {
        const items = data.cells[`${w}:${l.lessonId}`] ?? [];
        return items.some((c) => c.version !== '3.2' || c.status !== 'ready' || !c.voiceDone);
      }),
    );
  }, [data, onlyNonV32, weekFilter]);

  return (
    <div className="space-y-5">
      {/* Üst Kontrol & Filtre Şeridi */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sınıf Seçimi */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(data?.grades ?? []).map((g) => {
              const active = g.id === (gradeId ?? data?.selectedGradeId);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectGrade(g.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all border ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>

          {/* Hafta Filtresi + Yenile */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-background p-0.5 text-xs font-semibold">
              {([
                ['active', '1–11. Hafta'],
                ['term1', '1. Dönem (1–18)'],
                ['all', 'Tümü'],
              ] as [WeekFilter, string][]).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWeekFilter(k)}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    weekFilter === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none px-2 py-1 rounded-lg border border-border bg-background">
              <input
                type="checkbox"
                checked={onlyNonV32}
                onChange={(e) => setOnlyNonV32(e.target.checked)}
                className="rounded border-border"
              />
              Sadece v3.2 olmayanlar
            </label>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-background hover:bg-accent text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
        </div>

        {/* Özet Sürüm Sayaçları */}
        {data?.summary && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border text-xs">
            <span className="font-bold text-foreground">Toplam {data.summary.totalTopics} konu:</span>
            <span className="px-2.5 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 font-extrabold">
              v3.2: {data.summary.v32}
            </span>
            <span className="px-2.5 py-0.5 rounded-full border bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35 font-bold">
              v3.1: {data.summary.v31}
            </span>
            <span className="px-2.5 py-0.5 rounded-full border bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/35 font-bold">
              v3.0: {data.summary.v30}
            </span>
            <span className="px-2.5 py-0.5 rounded-full border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35 font-bold">
              v1: {data.summary.v1}
            </span>
            {data.summary.inProgress > 0 && (
              <span className="px-2.5 py-0.5 rounded-full border bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35 font-bold">
                İşlemde: {data.summary.inProgress}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full border bg-muted text-muted-foreground border-border font-bold">
              Yok: {data.summary.none}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Matris Tablosu */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading && !data ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Matris yükleniyor...</div>
        ) : !data || !visibleWeeks.length || !data.lessons.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Bu filtrede gösterilecek konu bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur border-b border-border">
                <tr>
                  <th className="sticky left-0 z-30 bg-muted/95 px-3 py-2.5 font-extrabold text-foreground border-r border-border whitespace-nowrap w-20">
                    Hafta
                  </th>
                  {data.lessons.map((lesson) => (
                    <th
                      key={lesson.lessonId}
                      className="px-3 py-2.5 font-extrabold text-foreground border-r border-border last:border-r-0 min-w-[175px]"
                    >
                      {lesson.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleWeeks.map((week) => (
                  <tr key={week} className={week === 11 ? 'bg-sky-500/5' : 'hover:bg-accent/30'}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-extrabold text-foreground border-r border-border whitespace-nowrap align-top">
                      <div className="flex items-center gap-1.5">
                        <span>{week}. Hf</span>
                        {week === 11 && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 font-black">
                            Aktif
                          </span>
                        )}
                      </div>
                    </td>
                    {data.lessons.map((lesson) => {
                      const items = (data.cells[`${week}:${lesson.lessonId}`] ?? []).filter((c) =>
                        onlyNonV32 ? c.version !== '3.2' || c.status !== 'ready' || !c.voiceDone : true,
                      );
                      return (
                        <td
                          key={lesson.lessonId}
                          className="px-2.5 py-2 border-r border-border last:border-r-0 align-top"
                        >
                          {items.length === 0 ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              {items.map((item) => {
                                const b = badgeStyle(item);
                                const spanNote =
                                  item.startWeek !== item.endWeek ? `${item.startWeek}–${item.endWeek}. hf` : `${item.startWeek}. hf`;
                                const tip = `${item.title}\nÜnite: ${item.unitTitle}\nHafta: ${spanNote}\nDers Notu: ${item.hasPublishedContent ? 'Yayında' : 'Yok'}\nSürüm: ${b.label}`;
                                const content = (
                                  <div
                                    title={tip}
                                    className="group flex items-start gap-1.5 rounded-lg border border-border/70 bg-background/80 px-2 py-1.5 hover:border-primary/50 hover:bg-accent/40 transition-colors"
                                  >
                                    <span
                                      className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[10px] leading-none font-bold ${b.cls}`}
                                    >
                                      {b.label}
                                    </span>
                                    <span className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-foreground line-clamp-2">
                                      {item.title}
                                    </span>
                                    {item.href && (
                                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                                    )}
                                  </div>
                                );
                                return item.href ? (
                                  <Link key={item.topicId} href={item.href} target="_blank" className="block">
                                    {content}
                                  </Link>
                                ) : (
                                  <div key={item.topicId}>{content}</div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
