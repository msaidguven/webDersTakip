'use client';

// Yazılı kağıdı kurucu (öğretmen paneli). 2026-11-11'den beri 3 sade adım: 1 Soru seç (havuz, konu süzgeci),
// 2 Düzenle ("Kağıdım": sürükle-bırak sıra, soru başı puan — varsayılan eşit dağıtım, elle değişince elle kalır;
// indirme asla engellenmez), 3 Bilgiler + PDF/Word indirme. Hazır/rastgele kağıt ve MEB senaryo rehberi kaldırıldı.
// Seçilen sorular hesapta saklanır (teacher_paper_drafts; telefonda seç, bilgisayarda aç); okul/öğretmen adı
// tüm yazılılarda ortak ve bu cihazda (localStorage) tutulur.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, FileDown, FileText, GripVertical, Image as ImageIcon, Plus, RotateCcw, ScanEye, Shuffle, X,
} from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import type { YaziliQuestion, YaziliTopic } from '@/app/src/lib/yazili/publicData';
import { DIFFICULTY_BAND_LABEL, difficultyBand, type DifficultyBand } from '@/app/src/lib/yazili/papers';
import r from '@/app/src/components/robotic/robotic.module.css';

// auto: soruyu sistem rastgele seçti (çıkarılırsa "remove" olumsuz sinyali kaydedilir; elle eklenende yok).
type Item = { id: number; points: number; auto?: boolean };
type Draft = { items: Item[]; autoPoints: boolean; title: string };
type Busy = 'paper' | 'key' | 'word' | null;
type Step = 1 | 2 | 3;

// v2 (2026-10-22): yalnız öğretmen alanı elle değiştirince yazılır; hiç yoksa profil bilgisi kullanılır.
// v1 açılışta boş değerleri de kaydediyordu, profil bilgisinin gelmesini engellerdi.
const INFO_KEY = 'dt-ogretmen-kagit-bilgi-v2';
const COLUMNS_KEY = 'dt-ogretmen-kagit-sutun';

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

// Soru değiştirme yardımcısı (yalnız tıklama işleyicisinden çağrılır).
const pickRandom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const difficultyLabel = (d: number | null) => DIFFICULTY_BAND_LABEL[difficultyBand(d)];

type BuilderProps = {
  exam: { id: number; gradeName: string; lessonName: string; label: string; national: boolean; path: string; defaultTitle: string };
  topics: YaziliTopic[];
  // Hesaptaki kayıtlı kağıt (teacher_paper_drafts); yoksa null.
  initialDraft: { items: Item[]; autoPoints: boolean; title: string } | null;
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
  initialDraft,
  profileDefaults,
}: BuilderProps) {
  const questionById = useMemo(() => new Map(topics.flatMap((t) => t.questions).map((q) => [q.id, q])), [topics]);
  const topicTitleByQuestion = useMemo(() => new Map(topics.flatMap((t) => t.questions.map((q) => [q.id, t.title]))), [topics]);
  // Hesaptaki kayıtlı kağıt (yalnız hâlâ havuzda olan sorular) ya da boş kağıt.
  const [draft, setDraft] = useState<Draft>(() => ({
    items: Array.isArray(initialDraft?.items) ? initialDraft.items.filter((i) => questionById.has(i.id)) : [],
    autoPoints: initialDraft?.autoPoints !== false,
    title: initialDraft?.title || exam.defaultTitle,
  }));
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
  const [bandFilter, setBandFilter] = useState<DifficultyBand | null>(null);
  const [hideAdded, setHideAdded] = useState(false);
  const [openAnswers, setOpenAnswers] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<Busy>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kayıtlı kağıdı olan öğretmen doğrudan Düzenle'ye, boş kağıtla gelen Soru seç'e.
  const [step, setStep] = useState<Step>(() => (draft.items.length ? 2 : 1));

  // Kağıt hesaba kaydedilir (değişiklikten 800 ms sonra; ilk açılışta yazılmaz). Başarısızlık öğretmenin işini
  // engellemez, bir sonraki değişiklikte yeniden denenir.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      fetch('/api/ogretmen/yazili/taslak', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: exam.id, items: draft.items, autoPoints: draft.autoPoints, title: draft.title }),
        keepalive: true,
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [exam.id, draft]);

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
  // Olumsuz sinyal kaydı (teacher_paper_events) — ateşle-unut, öğretmenin işini asla bekletmez.
  const logEvent = (body: { kind: 'remove' | 'swap'; questionId: number; replacedBy?: number }) => {
    fetch('/api/ogretmen/yazili/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId: exam.id, ...body }),
      keepalive: true,
    }).catch(() => {});
  };
  const toggleQuestion = (id: number) => {
    const existing = items.find((i) => i.id === id);
    if (existing?.auto) logEvent({ kind: 'remove', questionId: id });
    commitItems(existing ? items.filter((i) => i.id !== id) : [...items, { id, points: 0 }]);
  };

  // Öğrenme çıktısı → havuzdaki soru id'leri (rastgele kağıt ve "Bu soruyu değiştir" için).
  const poolByLo = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const t of topics) for (const q of t.questions) if (q.loCode) m.set(q.loCode, [...(m.get(q.loCode) ?? []), q.id]);
    return m;
  }, [topics]);
  const swapCandidates = (id: number) => {
    const code = questionById.get(id)?.loCode;
    return code ? (poolByLo.get(code) ?? []).filter((x) => !selectedIds.has(x)) : [];
  };
  // Aynı öğrenme çıktısından, kağıtta olmayan rastgele bir soruyla değiştir; sıra ve puan korunur.
  const swapQuestion = (id: number) => {
    const candidates = swapCandidates(id);
    if (!candidates.length) return;
    const next = pickRandom(candidates);
    logEvent({ kind: 'swap', questionId: id, replacedBy: next });
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { id: next, points: i.points, auto: true } : i)) }));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    commitItems(arrayMove(items, from, to));
  };
  const setPoints = (id: number, value: string) => {
    const n = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setDraft((d) => ({ ...d, autoPoints: false, items: d.items.map((i) => (i.id === id ? { ...i, points: n } : i)) }));
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

  const visibleTopics = topics
    .filter((t) => topicFilter === null || t.id === topicFilter)
    .map((t) => ({
      ...t,
      questions: t.questions.filter(
        (q) => (!bandFilter || difficultyBand(q.difficulty) === bandFilter) && (!hideAdded || !selectedIds.has(q.id))
      ),
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

  const goTo = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => document.getElementById('yazili-adimlar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const steps: { n: Step; label: string; status: string; done: boolean }[] = [
    { n: 1, label: 'Soru seç', status: `${items.length} soru`, done: items.length > 0 },
    { n: 2, label: 'Düzenle', status: total === 100 ? '100 puan ✓' : `${total} puan`, done: items.length > 0 && total === 100 },
    { n: 3, label: 'İndir', status: 'PDF · Word', done: false },
  ];

  // ── Bölümler (adımlarda kullanılır) ──
  const poolStep = (
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
        <span className="flex items-center gap-1.5" role="group" aria-label="Zorluk süzgeci">
          Zorluk:
          <button type="button" aria-pressed={bandFilter === null} className={chipCls(bandFilter === null)} onClick={() => setBandFilter(null)}>Tümü</button>
          {(Object.keys(DIFFICULTY_BAND_LABEL) as DifficultyBand[]).map((b) => (
            <button key={b} type="button" aria-pressed={bandFilter === b} className={chipCls(bandFilter === b)} onClick={() => setBandFilter(bandFilter === b ? null : b)}>
              {DIFFICULTY_BAND_LABEL[b]}
            </button>
          ))}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={hideAdded} onChange={(e) => setHideAdded(e.target.checked)} className="h-4 w-4 accent-cyan-600" />
          Kağıttakileri gizle
        </label>
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
  );

  const paperStep = (
    <section aria-labelledby="kagidim-baslik" className={`p-4 ${r.panel}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="kagidim-baslik" className={`text-lg font-bold uppercase text-default ${r.display}`}>Kağıdım</h2>
        <span className={`text-xs font-bold ${total === 100 ? 'text-emerald-500' : items.length ? 'text-amber-500' : 'text-muted-foreground'}`}>
          {items.length} soru · {total} puan
        </span>
      </div>
      {!items.length ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--edge)] p-4 text-center text-sm text-muted-foreground">
          Kağıtta soru yok.{' '}
          <button type="button" onClick={() => goTo(1)} className={`font-semibold hover:underline ${r.accent}`}>Soru seç</button>.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Sürükleyerek ya da oklarla sırala, puanı kutudan değiştir.</p>
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
                    onSwap={() => swapQuestion(it.id)}
                    swapCount={swapCandidates(it.id).length}
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
              <button type="button" onClick={() => goTo(1)} className={`inline-flex items-center gap-1 font-semibold hover:underline ${r.accent}`}>
                <Plus className="h-3 w-3" aria-hidden="true" /> Soru ekle
              </button>
              <button type="button" onClick={clearPaper} className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-red-500">
                <RotateCcw className="h-3 w-3" aria-hidden="true" /> Temizle
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );

  const downloadStep = (
    <section aria-labelledby="bilgiler" className={`p-4 ${r.panel}`}>
      <h2 id="bilgiler" className={`text-lg font-bold uppercase text-default ${r.display}`}>Kağıt bilgileri ve indir</h2>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Okul adı
          <input value={info.school} onChange={(e) => updateInfo({ school: e.target.value })} maxLength={120} placeholder="Boş bırakırsan elle yazılacak satır çıkar" className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Öğretmen adı (isteğe bağlı)
          <input value={info.teacherName} onChange={(e) => updateInfo({ teacherName: e.target.value })} maxLength={120} className={`mt-1 ${inputCls}`} />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Sınav başlığı
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={`mt-1 ${inputCls}`} />
        </label>
        <fieldset className="text-xs text-muted-foreground sm:col-span-2">
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

      {!items.length ? (
        <p className="mt-4 text-sm font-semibold text-amber-500">İndirmek için önce kağıda soru ekle.</p>
      ) : total !== 100 ? (
        <p className="mt-4 text-sm font-semibold text-amber-500">
          Toplam {total} puan.{' '}
          <button type="button" onClick={() => goTo(2)} className="underline">Düzenle</button> adımında 100&apos;e tamamlayabilirsin (indirme yine de açık).
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
  );

  return (
    <div id="yazili-adimlar" className="mt-6 scroll-mt-[60px] sm:scroll-mt-[72px]">
      {/* Adım çubuğu (2026-10-25): mobilde tek uzun sayfa yerine 4 adım; adımlar serbest, sıra zorunlu değil. */}
      <nav aria-label="Yazılı hazırlama adımları" className="sticky top-[60px] z-20 -mx-4 bg-[color:var(--bg)] px-4 py-2 sm:top-[72px] sm:mx-0 sm:px-0">
        <ol className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--edge)] bg-[var(--panel-solid)] p-1">
          {steps.map((s) => (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => goTo(s.n)}
                aria-current={step === s.n ? 'step' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition-colors sm:flex-row sm:justify-center sm:gap-2 ${
                  step === s.n ? 'bg-[color:color-mix(in_srgb,var(--neon)_12%,transparent)] text-[var(--neon)]' : 'text-muted-foreground hover:text-default'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    step === s.n ? 'border-[var(--neon)]' : s.done ? 'border-emerald-500 text-emerald-500' : 'border-[var(--edge)]'
                  }`}
                  aria-hidden="true"
                >
                  {s.done && step !== s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold leading-tight">{s.label}</span>
                  <span className="hidden text-[10px] leading-tight opacity-80 sm:block">{s.status}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-4 pb-28 lg:pb-24">
        {step === 1 && poolStep}
        {step === 2 && paperStep}
        {step === 3 && downloadStep}
      </div>

      {/* Alt çubuk: kağıt özeti + Geri/İleri (mobilde site sekme çubuğunun üstünde). */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 lg:bottom-4">
        <div className={`flex items-center gap-2 rounded-2xl border border-[var(--edge)] bg-[var(--panel-solid)] p-2 shadow-lg`}>
          <button
            type="button"
            onClick={() => goTo((step - 1) as Step)}
            disabled={step === 1}
            aria-label="Önceki adım"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 ${r.btnGhost}`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 text-center text-xs leading-tight text-muted-foreground">
            <span className="block font-bold text-default">{items.length} soru · {total} puan</span>
          </p>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => goTo((step + 1) as Step)}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-bold ${r.btnNeon} ${r.btnText}`}
            >
              {steps[step].label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => download('paper')}
              disabled={!items.length || busy !== null}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${r.btnNeon} ${r.btnText}`}
            >
              <FileDown className="h-4 w-4" aria-hidden="true" /> {busy === 'paper' ? 'Hazırlanıyor…' : 'Kağıt PDF'}
            </button>
          )}
        </div>
      </div>

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
  index, count, item, q, topicTitle, onPoints, onMove, onRemove, onSwap, swapCount,
}: {
  index: number; count: number; item: Item; q: YaziliQuestion; topicTitle: string;
  onPoints: (v: string) => void; onMove: (to: number) => void; onRemove: () => void;
  onSwap: () => void; swapCount: number;
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
      <button
        type="button"
        onClick={onSwap}
        disabled={!swapCount}
        aria-label={`${index + 1}. soruyu değiştir`}
        title={swapCount ? `Aynı öğrenme çıktısından başka bir soru getir (${swapCount} seçenek)` : 'Bu öğrenme çıktısında kağıtta olmayan başka soru yok'}
        className={`${iconBtn} hover:!text-[var(--neon)]`}
      >
        <Shuffle className="h-4 w-4" />
      </button>
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
