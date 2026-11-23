'use client';

// Yazılı seçici: masaüstünde sabit sol sidebar, mobilde tam ekran uygulama listesi (sınıf gruplu).
// 6'dan fazla yazılı varsa anlık arama kutusu çıkar; yatay kaydırma yok.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

export type SidebarExam = {
  id: number;
  gradeName: string;
  lessonName: string;
  label: string;
  questionCount: number;
  examDate: string | null;
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

export function YaziliSidebar({
  exams,
  selectedId,
  mode,
}: {
  exams: SidebarExam[];
  selectedId: number | null;
  mode: 'desktop' | 'mobile';
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return exams;
    return exams.filter((e) =>
      `${e.gradeName} ${e.lessonName} ${e.label}`.toLocaleLowerCase('tr').includes(q)
    );
  }, [exams, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SidebarExam[]>();
    for (const e of filtered) {
      const list = map.get(e.gradeName) ?? [];
      list.push(e);
      map.set(e.gradeName, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const searchBox = exams.length > 6 && (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sınıf veya ders ara…"
        aria-label="Yazılı ara"
        className="w-full rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)] py-2 pl-9 pr-8 text-sm text-default outline-none placeholder:text-muted-foreground focus:border-[var(--neon)]"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Aramayı temizle"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-default"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );

  if (mode === 'mobile') {
    return (
      <section aria-label="Ders ve yazılı seç" className="mt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Yazılı hazırlamak istediğin dersi seç.</p>
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{exams.length} yazılı</span>
        </div>

        {searchBox}

        {grouped.length === 0 ? (
          <p className={`rounded-2xl p-5 text-center text-sm text-muted-foreground ${r.panel}`}>
            Aramana uygun yazılı bulunamadı.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(([gradeName, list]) => (
              <div key={gradeName} className={`rounded-[22px] p-4 ${r.panel}`}>
                <h2 className={r.label}>{gradeName}</h2>
                <ul className={`mt-2 divide-y divide-[var(--border)] ${r.divider}`}>
                  {list.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/ogretmen/yazili?yazili=${e.id}`}
                        className="group flex min-h-14 items-center justify-between gap-3 py-2.5"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${r.chipBox}`} aria-hidden="true">
                            <BookOpen className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-default group-hover:text-[var(--neon)]">
                              {e.lessonName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {e.label} · {e.questionCount} soru{e.examDate ? ` · ${formatDate(e.examDate)}` : ''}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground ${r.groupHoverAccent}`} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <aside aria-label="Yazılı listesi" className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-3 rounded-[22px] p-4 border border-[var(--edge)] bg-[var(--panel-solid)]">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className={r.label}>Dersler & Yazılılar</span>
        <span className="text-[11px] font-semibold text-muted-foreground">{exams.length}</span>
      </div>

      {searchBox}

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {grouped.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">Eşleşen yazılı yok.</p>
        ) : (
          grouped.map(([gradeName, list]) => (
            <div key={gradeName}>
              <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {gradeName}
              </p>
              <ul className="flex flex-col gap-1">
                {list.map((e) => {
                  const active = e.id === selectedId;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/ogretmen/yazili?yazili=${e.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={`block rounded-xl px-3 py-2.5 transition-colors ${
                          active
                            ? 'border border-[var(--neon)] bg-[color:color-mix(in_srgb,var(--neon)_10%,transparent)] text-default'
                            : 'border border-transparent text-muted-foreground hover:bg-[color:color-mix(in_srgb,var(--edge)_40%,transparent)] hover:text-default'
                        }`}
                      >
                        <span className={`block truncate text-sm font-bold ${active ? 'text-[var(--neon)]' : 'text-default'}`}>
                          {e.lessonName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {e.label} · {e.questionCount} soru{e.examDate ? ` · ${formatDate(e.examDate)}` : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
