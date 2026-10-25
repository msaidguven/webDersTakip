'use client';

// Yazılı kağıdı kurucu (öğretmen paneli). Solda yazılının soru havuzu (konu/öğrenme çıktısı süzgeci),
// sağda "Kağıdım": sürükle-bırak sıra, soru başı puan (varsayılan eşit dağıtım, elle değişince elle kalır),
// MEB rehberi (seçilen senaryonun öğrenme çıktısı dağılımı ↔ kağıt; yalnız bilgi, indirme asla engellenmez)
// ve PDF/Word indirme. Taslak bu cihazda (localStorage) saklanır; okul/öğretmen adı tüm yazılılarda ortak.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Eye, FileDown, FileText, GripVertical, Image as ImageIcon, Plus, RotateCcw, ScanEye, X,
} from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import type { ScenarioRow, YaziliQuestion, YaziliTopic } from '@/app/src/lib/yazili/publicData';
import r from '@/app/src/components/robotic/robotic.module.css';

export type BuilderPreset = { scenario: number | null; label: string; items: { id: number; points: number }[] };

type Item = { id: number; points: number };
type Draft = { items: Item[]; autoPoints: boolean; scenario: number; title: string };
type Busy = 'paper' | 'key' | 'word' | null;

// v2 (2026-10-22): yalnız öğretmen alanı elle değiştirince yazılır; hiç yoksa profil bilgisi kullanılır.
// v1 açılışta boş değerleri de kaydediyordu, profil bilgisinin gelmesini engellerdi.
const INFO_KEY = 'dt-ogretmen-kagit-bilgi-v2';
const COLUMNS_KEY = 'dt-ogretmen-kagit-sutun';
const draftKey = (examId: number) => `dt-yazili-kagit:${examId}`;

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // gizli pencere / kota — taslak yalnız bu oturumda kalır
  }
}

// papers.ts distributePoints ile aynı: eşit pay, artan puan sondaki sorulara.
function equalPoints(n: number): number[] {
  if (!n) return [];
  const base = Math.floor(100 / n);
  const rem = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - rem ? 1 : 0));
}

const difficultyLabel = (d: number | null) => ((d ?? 3) <= 2 ? 'Kolay' : (d ?? 3) >= 4 ? 'Zor' : 'Orta');

type BuilderProps = {
  exam: { id: number; gradeName: string; lessonName: string; label: string; national: boolean; path: string; defaultTitle: string };
  topics: YaziliTopic[];
  scenarios: ScenarioRow[];
  scenarioCount: number;
  nationalNeed: Record<string, number>;
  presets: BuilderPreset[];
  // Öğretmenin profilinden (okul adı, ad soyad): kağıt bilgileri hiç düzenlenmediyse bunlarla dolar.
  profileDefaults: { school: string; teacherName: string };
};

const noopSubscribe = () => () => {};

// Taslak localStorage'dan ilk render'da okunur; sunucu HTML'iyle çakışmasın diye kurucu yalnız tarayıcıda açılır.
export function YaziliBuilder(props: BuilderProps) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <div className={`mt-6 h-96 animate-pulse rounded-2xl ${r.item}`} aria-hidden="true" />;
  return <Builder {...props} />;
}

function Builder({
  exam,
  topics,
  scenarios,
  scenarioCount,
  nationalNeed,
  presets,
  profileDefaults,
}: BuilderProps) {
  const questionById = useMemo(() => new Map(topics.flatMap((t) => t.questions).map((q) => [q.id, q])), [topics]);
  const topicTitleByQuestion = useMemo(() => new Map(topics.flatMap((t) => t.questions.map((q) => [q.id, t.title]))), [topics]);
  const loTopicTitles = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of topics) for (const c of t.loCodes) m.set(c, [...(m.get(c) ?? []), t.title]);
    return m;
  }, [topics]);

  // Kayıtlı taslak (yalnız hâlâ havuzda olan sorular) ya da boş kağıt.
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = readStorage<Draft>(draftKey(exam.id));
    return {
      items: Array.isArray(saved?.items) ? saved.items.filter((i) => questionById.has(i.id)) : [],
      autoPoints: saved?.autoPoints !== false,
      scenario: scenarioCount ? Math.min(Math.max(1, saved?.scenario || 1), scenarioCount) : 0,
      title: saved?.title || exam.defaultTitle,
    };
  });
  const [info, setInfo] = useState(() => {
    const saved = readStorage<{ school?: string; teacherName?: string }>(INFO_KEY);
    return saved ? { school: saved.school ?? '', teacherName: saved.teacherName ?? '' } : profileDefaults;
  });
  // Öğretmenin kendi değişikliği (silmek dahil) saklanır ve profil bilgisinin önüne geçer.
  const updateInfo = (patch: Partial<typeof info>) => {
    const next = { ...info, ...patch };
    setInfo(next);
    writeStorage(INFO_KEY, next);
  };
  // Kağıt düzeni (tek/iki sütun) öğretmenin tercihi; okul/ad bilgisinden ayrı saklanır ki yalnız sütunu
  // değiştirmek profil bilgisini "elle düzenlenmiş" yapmasın.
  const [columns, setColumns] = useState<1 | 2>(() => (readStorage<number>(COLUMNS_KEY) === 2 ? 2 : 1));
  const chooseColumns = (n: 1 | 2) => {
    setColumns(n);
    writeStorage(COLUMNS_KEY, n);
  };
  const [topicFilter, setTopicFilter] = useState<number | null>(null);
  const [loFilter, setLoFilter] = useState<string | null>(null);
  const [hideAdded, setHideAdded] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => writeStorage(draftKey(exam.id), draft), [exam.id, draft]);

  const { items, autoPoints } = draft;
  const selectedIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  // Havuzdaki seçili kart, sorunun kağıttaki sırasını ve puanını gösterir.
  const positionById = useMemo(() => new Map(items.map((it, i) => [it.id, { no: i + 1, points: it.points }])), [items]);
  const total = items.reduce((n, i) => n + i.points, 0);

  // Sıra/küme değişince otomatik moddaysa puanlar yeniden eşit dağıtılır.
  const commitItems = (next: Item[], auto = autoPoints) => {
    const pts = equalPoints(next.length);
    setDraft((d) => ({ ...d, autoPoints: auto, items: auto ? next.map((it, i) => ({ ...it, points: pts[i] })) : next }));
  };
  const toggleQuestion = (id: number) =>
    commitItems(selectedIds.has(id) ? items.filter((i) => i.id !== id) : [...items, { id, points: 0 }]);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    commitItems(arrayMove(items, from, to));
  };
  const setPoints = (id: number, value: string) => {
    const n = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setDraft((d) => ({ ...d, autoPoints: false, items: d.items.map((i) => (i.id === id ? { ...i, points: n } : i)) }));
  };
  const applyPreset = (p: BuilderPreset) => {
    if (items.length && !window.confirm('Kağıttaki sorular hazır kağıtla değiştirilsin mi?')) return;
    setDraft((d) => ({ ...d, items: p.items, autoPoints: true, scenario: p.scenario ?? d.scenario }));
  };
  const clearPaper = () => {
    if (window.confirm('Kağıttaki tüm sorular çıkarılsın mı?')) setDraft((d) => ({ ...d, items: [], autoPoints: true }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
  };

  // MEB rehberi: istenen (senaryo ya da ülke geneli dengeli öneri) ↔ kağıttaki öğrenme çıktısı sayısı.
  const guide = useMemo(() => {
    const need = new Map<string, number>();
    if (exam.national || !scenarioCount) {
      for (const [c, n] of Object.entries(nationalNeed)) need.set(c, n);
    } else {
      for (const s of scenarios) if (s.counts[draft.scenario]) need.set(s.loCode, s.counts[draft.scenario]);
    }
    const have = new Map<string, number>();
    let unknown = 0;
    for (const it of items) {
      const code = questionById.get(it.id)?.loCode;
      if (code) have.set(code, (have.get(code) ?? 0) + 1);
      else unknown += 1;
    }
    const codes = [...new Set([...need.keys(), ...have.keys()])].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    const rows = codes.map((code) => ({ code, need: need.get(code) ?? 0, have: have.get(code) ?? 0, topics: loTopicTitles.get(code) ?? [] }));
    const needTotal = [...need.values()].reduce((a, b) => a + b, 0);
    return { rows, unknown, needTotal, allOk: rows.every((r) => r.need === r.have) && unknown === 0 && items.length > 0 };
  }, [exam.national, scenarioCount, nationalNeed, scenarios, draft.scenario, items, questionById, loTopicTitles]);

  const visibleTopics = topics
    .filter((t) => topicFilter === null || t.id === topicFilter)
    .map((t) => ({
      ...t,
      questions: t.questions.filter((q) => (!loFilter || q.loCode === loFilter) && (!hideAdded || !selectedIds.has(q.id))),
    }))
    .filter((t) => t.questions.length);

  const paperBody = (answerKey: boolean) =>
    JSON.stringify({ examId: exam.id, items, school: info.school, teacherName: info.teacherName, title: draft.title, answerKey, columns });

  async function download(kind: Exclude<Busy, null>) {
    if (!items.length) return;
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(kind === 'word' ? '/api/ogretmen/yazili/word' : '/api/ogretmen/yazili/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: paperBody(kind === 'key'),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'İndirme başarısız oldu');
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? (kind === 'word' ? 'yazili.docx' : 'yazili.pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Bağlantı hatası, tekrar dene');
    } finally {
      setBusy(null);
    }
  }

  const inputCls = 'w-full rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)] px-3 py-2 text-sm text-default outline-none focus:border-[var(--neon)]';
  const chipCls = (active: boolean) =>
    `shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${active ? 'border-[var(--neon)] text-[var(--neon)]' : 'border-[var(--edge)] text-muted-foreground hover:text-default'}`;

  return (
    <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* ── Soru havuzu ── */}
      <section aria-labelledby="havuz" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="havuz" className={`text-lg font-bold uppercase text-default ${r.display}`}>Soru havuzu</h2>
          <Link href={exam.path} target="_blank" className={`text-xs font-semibold hover:underline ${r.accent}`}>Herkese açık sayfa ↗</Link>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Konu süzgeci">
          <button type="button" className={chipCls(topicFilter === null)} onClick={() => setTopicFilter(null)}>
            Tüm konular ({topics.reduce((n, t) => n + t.questions.length, 0)})
          </button>
          {topics.map((t) => (
            <button key={t.id} type="button" className={chipCls(topicFilter === t.id)} onClick={() => setTopicFilter(topicFilter === t.id ? null : t.id)}>
              {t.title} ({t.questions.length})
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={hideAdded} onChange={(e) => setHideAdded(e.target.checked)} className="h-4 w-4 accent-cyan-600" />
            Kağıttakileri gizle
          </label>
          {loFilter && (
            <button type="button" onClick={() => setLoFilter(null)} className={`inline-flex items-center gap-1 ${chipCls(true)}`}>
              {loFilter} <X className="h-3 w-3" aria-hidden="true" /><span className="sr-only">süzgecini kaldır</span>
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-6">
          {visibleTopics.map((t) => (
            <div key={t.id}>
              <h3 className="mb-2 text-sm font-bold text-default">
                {t.title} <span className="font-normal text-muted-foreground">· {t.questions.length} soru</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {t.questions.map((q) => (
                  <PoolCard
                    key={q.id}
                    q={q}
                    added={selectedIds.has(q.id)}
                    position={positionById.get(q.id)}
                    answerOpen={openAnswers.has(q.id)}
                    onToggle={() => toggleQuestion(q.id)}
                    onToggleAnswer={() =>
                      setOpenAnswers((s) => {
                        const n = new Set(s);
                        if (n.has(q.id)) n.delete(q.id);
                        else n.add(q.id);
                        return n;
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          ))}
          {!visibleTopics.length && <p className="text-sm text-muted-foreground">Bu süzgeçle gösterilecek soru kalmadı.</p>}
        </div>
      </section>

      {/* ── Kağıdım ── */}
      <aside id="kagidim" aria-labelledby="kagidim-baslik" className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <section className={`p-4 ${r.panel}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="kagidim-baslik" className={`text-lg font-bold uppercase text-default ${r.display}`}>Kağıdım</h2>
            <span className={`text-xs font-bold ${total === 100 ? 'text-emerald-500' : items.length ? 'text-amber-500' : 'text-muted-foreground'}`}>
              {items.length} soru · {total} puan
            </span>
          </div>

          {presets.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">Hazır kağıtla başla:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button key={p.label} type="button" onClick={() => applyPreset(p)} className={chipCls(false)}>{p.label}</button>
                ))}
              </div>
            </div>
          )}

          {!items.length ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--edge)] p-4 text-center text-sm text-muted-foreground">
              Havuzdan <Plus className="inline h-3.5 w-3.5" aria-label="ekle" /> ile soru ekle ya da hazır kağıtla başla.
            </p>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <ol className="mt-3 flex flex-col gap-1.5">
                    {items.map((it, idx) => (
                      <PaperRow
                        key={it.id}
                        index={idx}
                        count={items.length}
                        item={it}
                        q={questionById.get(it.id)!}
                        topicTitle={topicTitleByQuestion.get(it.id) ?? ''}
                        onPoints={(v) => setPoints(it.id, v)}
                        onMove={(to) => move(idx, to)}
                        onRemove={() => toggleQuestion(it.id)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                {total === 100 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-500"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Toplam 100 puan</span>
                ) : (
                  <span className="font-semibold text-amber-500">Toplam {total} puan — 100 olmalı</span>
                )}
                <div className="flex gap-3">
                  {!autoPoints || total !== 100 ? (
                    <button type="button" onClick={() => commitItems(items, true)} className={`font-semibold hover:underline ${r.accent}`}>Puanları eşit dağıt</button>
                  ) : null}
                  <button type="button" onClick={clearPaper} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-red-500">
                    <RotateCcw className="h-3 w-3" aria-hidden="true" /> Temizle
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <section aria-labelledby="rehber" className={`p-4 ${r.panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rehber" className={`text-sm font-bold uppercase text-default ${r.display}`}>MEB rehberi</h2>
            {!exam.national && scenarioCount > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Zümre senaryosu
                <select
                  value={draft.scenario}
                  onChange={(e) => setDraft((d) => ({ ...d, scenario: Number(e.target.value) }))}
                  className="rounded-lg border border-[var(--edge)] bg-[var(--panel-solid)] px-2 py-1 text-xs text-default"
                >
                  {Array.from({ length: scenarioCount }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}. senaryo</option>)}
                </select>
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {exam.national
              ? 'Ülke geneli sınav: kitapçığı MEB gönderir. Deneme kağıdı için kapsamdaki öğrenme çıktılarından dengeli dağılım önerisi.'
              : `Seçilen senaryoda öğrenme çıktısı başına istenen soru sayısı (toplam ${guide.needTotal}). Yalnız bilgi verir; karar senin.`}
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {guide.rows.map((row) => {
              const diff = row.have - row.need;
              const status = !row.need
                ? { text: 'Senaryoda yok', cls: 'text-muted-foreground' }
                : diff === 0
                  ? { text: '✓ Tamam', cls: 'text-emerald-500' }
                  : diff < 0
                    ? { text: `${-diff} eksik`, cls: 'text-amber-500' }
                    : { text: `${diff} fazla`, cls: 'text-amber-500' };
              return (
                <li key={row.code}>
                  <button
                    type="button"
                    onClick={() => setLoFilter(loFilter === row.code ? null : row.code)}
                    title="Havuzu bu öğrenme çıktısına göre süz"
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--panel-solid)] ${loFilter === row.code ? 'ring-1 ring-[var(--neon)]' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`font-semibold ${r.mono} text-default`}>{row.code}</span>
                      <span className="block truncate text-muted-foreground">{row.topics.join(', ') || '—'}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-default">{row.have}/{row.need || '–'}</span>
                    <span className={`w-20 shrink-0 text-right font-semibold ${status.cls}`}>{status.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {guide.unknown > 0 && <p className="mt-2 text-xs text-muted-foreground">{guide.unknown} sorunun öğrenme çıktısı belirsiz, rehbere sayılmadı.</p>}
          {guide.allOk && <p className="mt-2 text-xs font-semibold text-emerald-500">Kağıt bu dağılıma birebir uyuyor.</p>}
        </section>

        <section aria-labelledby="bilgiler" className={`p-4 ${r.panel}`}>
          <h2 id="bilgiler" className={`text-sm font-bold uppercase text-default ${r.display}`}>Kağıt bilgileri</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            <label className="text-xs text-muted-foreground">
              Okul adı
              <input value={info.school} onChange={(e) => updateInfo({ school: e.target.value })} maxLength={120} placeholder="Boş bırakırsan elle yazılacak satır çıkar" className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs text-muted-foreground">
              Sınav başlığı
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="text-xs text-muted-foreground">
              Öğretmen adı (isteğe bağlı)
              <input value={info.teacherName} onChange={(e) => updateInfo({ teacherName: e.target.value })} maxLength={120} className={`mt-1 ${inputCls}`} />
            </label>
            <fieldset className="text-xs text-muted-foreground">
              <legend>Sayfa düzeni</legend>
              <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup">
                {([1, 2] as const).map((n) => (
                  <label
                    key={n}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      columns === n ? 'border-[var(--neon)] text-[var(--neon)]' : 'border-[var(--edge)] text-muted-foreground hover:text-default'
                    }`}
                  >
                    <input type="radio" name="sayfa-duzeni" checked={columns === n} onChange={() => chooseColumns(n)} className="sr-only" />
                    <ColumnsIcon count={n} />
                    {n === 1 ? 'Tek sütun' : 'İki sütun'}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={!items.length}
              className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${r.btnGhost}`}
            >
              <ScanEye className="h-4 w-4" aria-hidden="true" /> Önizle
            </button>
            <DownloadButton kind="paper" busy={busy} disabled={!items.length} onClick={() => download('paper')} primary icon={<FileDown className="h-4 w-4" aria-hidden="true" />} label="Kağıt PDF" />
            <DownloadButton kind="key" busy={busy} disabled={!items.length} onClick={() => download('key')} icon={<FileDown className="h-4 w-4" aria-hidden="true" />} label="Cevap anahtarı" />
            <DownloadButton kind="word" busy={busy} disabled={!items.length} onClick={() => download('word')} icon={<FileText className="h-4 w-4" aria-hidden="true" />} label="Word" />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Word dosyası düzenlenebilir; içinde cevap anahtarı ayrı sayfadadır. Taslağın bu cihazda saklanır.
          </p>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
        </section>
      </aside>

      {previewOpen && (
        <PaperPreview
          load={(answerKey) =>
            fetch('/api/ogretmen/yazili/onizleme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: paperBody(answerKey) })
          }
          busy={busy}
          onDownload={download}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* Mobil: havuzda gezinirken kağıt özeti ve kağıda atlama */}
      <a
        href="#kagidim"
        className={`fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold lg:hidden ${r.btnNeon}`}
      >
        <span>Kağıdım · {items.length} soru · {total} puan</span>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

function DownloadButton({
  kind, busy, disabled, onClick, label, icon, primary = false,
}: { kind: Exclude<Busy, null>; busy: Busy; disabled: boolean; onClick: () => void; label: string; icon: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy !== null}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${primary ? `${r.btnNeon}` : r.btnGhost}`}
    >
      {icon}
      {busy === kind ? 'Hazırlanıyor…' : label}
    </button>
  );
}

function PoolCard({
  q, added, position, answerOpen, onToggle, onToggleAnswer,
}: {
  q: YaziliQuestion; added: boolean; position?: { no: number; points: number };
  answerOpen: boolean; onToggle: () => void; onToggleAnswer: () => void;
}) {
  return (
    <li
      className={`rounded-2xl p-3 sm:p-4 ${r.item} ${
        added ? `${r.neonBorder} border-l-[5px] !bg-[color-mix(in_srgb,var(--neon)_11%,var(--panel-solid))] shadow-[0_0_0_1px_var(--neon)]` : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {added && position && (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--neon)] px-2 py-0.5 text-[11px] font-bold text-white">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> Kağıtta · {position.no}. soru · {position.points} puan
            </p>
          )}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            {q.loCode && <span className={r.badge}>{q.loCode}</span>}
            <span className="text-muted-foreground">{difficultyLabel(q.difficulty)}</span>
            {q.svgContent && <span className="inline-flex items-center gap-0.5 text-muted-foreground"><ImageIcon className="h-3 w-3" aria-hidden="true" /> görselli</span>}
          </div>
          {q.svgPosition === 'above' && q.svgContent && <YaziliSvg svgContent={q.svgContent} />}
          <MathText text={q.text} as="p" className="text-sm leading-relaxed text-default" />
          {q.svgPosition === 'below' && q.svgContent && <YaziliSvg svgContent={q.svgContent} />}
          <button type="button" onClick={onToggleAnswer} aria-expanded={answerOpen} className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${r.accent}`}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {answerOpen ? 'Cevabı gizle' : 'Cevabı gör'}
          </button>
          {answerOpen && (
            <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-[var(--edge)] p-3 text-xs">
              <p><b className="text-default">Cevap:</b> <MathText text={q.modelAnswer} className="text-default" /></p>
              {q.rubric && <p className="whitespace-pre-line text-muted-foreground"><b className="text-default">Puanlama:</b> {q.rubric}</p>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={added}
          aria-label={added ? 'Kağıttan çıkar' : 'Kağıda ekle'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${added ? r.btnNeon : r.btnGhost}`}
        >
          {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </li>
  );
}

function PaperRow({
  index, count, item, q, topicTitle, onPoints, onMove, onRemove,
}: {
  index: number; count: number; item: Item; q: YaziliQuestion; topicTitle: string;
  onPoints: (v: string) => void; onMove: (to: number) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const iconBtn = 'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-default disabled:opacity-30';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl p-2 ${r.item} ${isDragging ? `z-10 ${r.neonBorder} shadow-lg` : ''}`}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`${index + 1}. soruyu sürükle`} className="cursor-grab touch-none text-muted-foreground hover:text-default active:cursor-grabbing">
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-bold text-default">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <MathText text={q.text} as="p" className="line-clamp-2 text-xs leading-snug text-default" />
        <p className="truncate text-[10.5px] text-muted-foreground">{q.loCode ?? topicTitle}</p>
      </div>
      <label className="flex shrink-0 items-center gap-1 text-[10.5px] text-muted-foreground">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={item.points}
          onChange={(e) => onPoints(e.target.value)}
          aria-label={`${index + 1}. soru puanı`}
          className="w-12 rounded-lg border border-[var(--edge)] bg-[var(--panel-solid)] px-1.5 py-1 text-center text-xs font-bold text-default outline-none focus:border-[var(--neon)]"
        />
        p
      </label>
      <div className="flex shrink-0 flex-col">
        <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} aria-label="Yukarı taşı" className={iconBtn}><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1} aria-label="Aşağı taşı" className={iconBtn}><ArrowDown className="h-3.5 w-3.5" /></button>
      </div>
      <button type="button" onClick={onRemove} aria-label="Kağıttan çıkar" className={`${iconBtn} hover:!text-red-500`}><X className="h-4 w-4" /></button>
    </li>
  );
}

// İndirmeden önce önizleme: PDF'in basıldığı HTML'in aynısı (bkz. /api/ogretmen/yazili/onizleme), sandbox'lı
// iframe'de A4 görünümünde. Sekmeler kağıt / cevap anahtarı; indirme buradan da yapılır.
function PaperPreview({
  load, busy, onDownload, onClose,
}: {
  load: (answerKey: boolean) => Promise<Response>;
  busy: Busy;
  onDownload: (kind: Exclude<Busy, null>) => void;
  onClose: () => void;
}) {
  const [answerKey, setAnswerKey] = useState(false);
  const [doc, setDoc] = useState<{ key: boolean; html: string } | { key: boolean; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(answerKey)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setDoc(res.ok && data?.html ? { key: answerKey, html: data.html } : { key: answerKey, error: data?.error || 'Önizleme hazırlanamadı' });
      })
      .catch(() => !cancelled && setDoc({ key: answerKey, error: 'Bağlantı hatası' }));
    return () => {
      cancelled = true;
    };
    // load her render'da yeni; önizleme yalnız açılışta ve sekme değişince yenilenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const current = doc && doc.key === answerKey ? doc : null;
  const tab = (key: boolean, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={answerKey === key}
      onClick={() => setAnswerKey(key)}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${answerKey === key ? 'bg-[var(--neon)] text-white' : 'text-muted-foreground hover:text-default'}`}
    >
      {label}
    </button>
  );

  return (
    <div role="dialog" aria-modal="true" aria-label="Kağıt önizlemesi" className="fixed inset-0 z-[80] flex flex-col bg-black/70 backdrop-blur-sm sm:p-6">
      <div className={`mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden sm:rounded-2xl ${r.themeVars} bg-[var(--panel-solid)]`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--edge)] p-3">
          <div role="tablist" aria-label="Önizlenecek belge" className="flex gap-1">
            {tab(false, 'Kağıt')}
            {tab(true, 'Cevap anahtarı')}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDownload(answerKey ? 'key' : 'paper')}
              disabled={busy !== null}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold disabled:opacity-50 ${r.btnNeon}`}
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {busy === (answerKey ? 'key' : 'paper') ? 'Hazırlanıyor…' : 'PDF indir'}
            </button>
            <button type="button" onClick={onClose} aria-label="Önizlemeyi kapat" className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-default">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 bg-[#d9dee6]">
          {!current ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">Önizleme hazırlanıyor…</div>
          ) : 'error' in current ? (
            <div role="alert" className="flex h-full items-center justify-center text-sm font-semibold text-red-600">{current.error}</div>
          ) : (
            // Script yok (sandbox=""), içerik sunucunun ürettiği sabit HTML.
            <iframe title={answerKey ? 'Cevap anahtarı önizlemesi' : 'Kağıt önizlemesi'} srcDoc={current.html} sandbox="" className="h-full w-full border-0" />
          )}
        </div>
        <p className="border-t border-[var(--edge)] px-3 py-2 text-[11px] text-muted-foreground">
          Önizleme PDF ile aynı şablondan gelir; sayfa sonları ve sayfa numaraları yalnız PDF&apos;te görünür.
        </p>
      </div>
    </div>
  );
}

// Sayfa düzeni seçiminde küçük kağıt simgesi (tek / iki sütun satırları).
function ColumnsIcon({ count }: { count: 1 | 2 }) {
  return (
    <svg viewBox="0 0 20 24" className="h-5 w-4 shrink-0" aria-hidden="true">
      <rect x="1" y="1" width="18" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {count === 1
        ? [6, 10, 14, 18].map((y) => <line key={y} x1="4" x2="16" y1={y} y2={y} stroke="currentColor" strokeWidth="1.5" />)
        : [6, 10, 14, 18].flatMap((y) => [
            <line key={`a${y}`} x1="4" x2="9" y1={y} y2={y} stroke="currentColor" strokeWidth="1.5" />,
            <line key={`b${y}`} x1="11" x2="16" y1={y} y2={y} stroke="currentColor" strokeWidth="1.5" />,
          ])}
    </svg>
  );
}
