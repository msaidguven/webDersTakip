'use client';

// "Yeni yazılı aç" (2026-10-26): giriş yapmış öğrenci için rastgele soruyla yazılı; 2026-10-28 dağılımı öğrenci
// seçer: MEB senaryosu ya da üzerinde değişiklik yaptığı "kendi dağılımı" (öğrenme çıktısı bazında);
// cevaplar yazılır, yapay zekâ puanlar. Günde 3 hak (reklamsız). Cevap anahtarı puanlanana kadar gelmez.
// Yazılan cevaplar sayfa yenilenirse kaybolmasın diye tarayıcıda taslak olarak tutulur.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Loader2, Minus, PenLine, Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import { CUSTOM_MAX_TOTAL, initialPlan, type LoOption } from '@/app/src/lib/yazili/papers';
import type { ScenarioRow } from '@/app/src/lib/yazili/publicData';
import r from '@/app/src/components/robotic/robotic.module.css';

type Item = {
  id: number; points: number; textHtml: string; svg: string | null; svgPosition: 'above' | 'below';
  answer: string; imageUrl: string | null; asksDrawing: boolean;
  score: number | null; feedback: string | null; answerHtml: string | null;
};
type Attempt = { id: number; status: 'in_progress' | 'submitted' | 'graded'; scenario: number | null; variant: number | null; totalScore: number | null; items: Item[] };
type State = { used: number; limit: number; attempt: Attempt | null; history: HistoryItem[] };

const MAX_LEN = 2000;
const MAX_PHOTO_SIDE = 1600;
const draftKey = (id: number) => `yazili-taslak-${id}`;
const fmt = (n: number) => String(n).replace('.', ',');
const scenarioLabel = (s: number | null) => (s ? `MEB ${s}. senaryo` : 'Kendi dağılımın');
const scenarioCounts = (rows: ScenarioRow[], s: number) => Object.fromEntries(rows.filter((r) => r.counts[s]).map((r) => [r.loCode, r.counts[s]]));

// Fotoğrafı yüklemeden önce JPEG'e çevirip küçültür: boyut düşer, EXIF/konum bilgisi de düşer.
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.82));
}

type PlanProps = { loOptions: LoOption[]; scenarios: ScenarioRow[]; scenarioCount: number };

export function YaziliLiveExam({ sinif, ders, yazili, loOptions, scenarios, scenarioCount }: { sinif: string; ders: string; yazili: string } & PlanProps) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [state, setState] = useState<State | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<'start' | 'grade' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [photos, setPhotos] = useState<Record<number, string | null>>({});
  const [photoBusy, setPhotoBusy] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<{ id: number; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ident = { sinif, ders, yazili };
  const [scenario, setScenario] = useState<number | null>(scenarioCount > 0 ? 1 : null);
  const [plan, setPlan] = useState<[string, number][]>(() => initialPlan(loOptions, scenarioCount > 0 ? scenarioCounts(scenarios, 1) : null));

  const open = useCallback((s: State) => {
    setState(s);
    let draft: Record<number, string> = {};
    if (s.attempt && s.attempt.status !== 'graded') {
      try {
        draft = JSON.parse(localStorage.getItem(draftKey(s.attempt.id)) ?? '{}');
      } catch {
        draft = {};
      }
    }
    setAnswers(Object.fromEntries((s.attempt?.items ?? []).map((i) => [i.id, i.answer || draft[i.id] || ''])));
    setPhotos(Object.fromEntries((s.attempt?.items ?? []).map((i) => [i.id, i.imageUrl])));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch(`/api/yazili/deneme?${new URLSearchParams(ident)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((s: State | null) => { if (!cancelled && s) open(s); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sinif, ders, yazili, open]);

  const attempt = state?.attempt ?? null;
  const left = state ? Math.max(0, state.limit - state.used) : null;

  const setAnswer = (id: number, text: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: text.slice(0, MAX_LEN) };
      if (attempt) {
        try { localStorage.setItem(draftKey(attempt.id), JSON.stringify(next)); } catch { /* taslak önbelleği yoksa sorun değil */ }
      }
      return next;
    });
  };

  const start = async () => {
    setBusy('start'); setError(null);
    try {
      const res = await fetch('/api/yazili/deneme', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ident, plan }) });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Yazılı açılamadı');
        if (json.used != null) setState((s) => ({ used: json.used, limit: json.limit, attempt: s?.attempt ?? null, history: s?.history ?? [] }));
      } else {
        open({ ...json, history: state?.history ?? [] });
        setModalOpen(true);
      }
    } catch {
      setError('Bağlantı hatası, tekrar dene.');
    }
    setBusy(null);
  };

  const grade = async () => {
    if (!attempt) return;
    setBusy('grade'); setError(null);
    try {
      const res = await fetch(`/api/yazili/deneme/${attempt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ident, answers: attempt.items.map((i) => ({ questionId: i.id, text: answers[i.id] ?? '' })) }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? 'Kontrol edilemedi');
      else {
        try { localStorage.removeItem(draftKey(attempt.id)); } catch { /* yoksay */ }
        const done: Attempt = json.attempt;
        setState((s) => s && {
          ...s,
          attempt: done,
          history: [{ id: done.id, createdAt: new Date().toISOString(), scenario: done.scenario, totalScore: done.totalScore ?? 0, maxPoints: done.items.reduce((sum, i) => sum + i.points, 0) }, ...s.history.filter((h) => h.id !== done.id)],
        });
      }
    } catch {
      setError('Bağlantı hatası, tekrar dene.');
    }
    setBusy(null);
  };

  const pickPhoto = async (questionId: number, file: File) => {
    if (!attempt) return;
    setPhotoBusy(questionId); setPhotoError(null);
    try {
      const blob = await toJpeg(file);
      const res = await fetch(`/api/yazili/deneme/${attempt.id}/foto?soru=${questionId}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const json = await res.json();
      if (!res.ok) setPhotoError({ id: questionId, message: json.error ?? 'Fotoğraf yüklenemedi' });
      else setPhotos((prev) => ({ ...prev, [questionId]: json.imageUrl }));
    } catch {
      setPhotoError({ id: questionId, message: 'Fotoğraf okunamadı. Başka bir fotoğraf dene.' });
    }
    setPhotoBusy(null);
  };

  const removePhoto = async (questionId: number) => {
    if (!attempt) return;
    setPhotoBusy(questionId); setPhotoError(null);
    try {
      await fetch(`/api/yazili/deneme/${attempt.id}/foto?soru=${questionId}`, { method: 'DELETE' });
      setPhotos((prev) => ({ ...prev, [questionId]: null }));
    } catch {
      setPhotoError({ id: questionId, message: 'Fotoğraf kaldırılamadı, tekrar dene.' });
    }
    setPhotoBusy(null);
  };

  const total = attempt?.items.reduce((sum, i) => sum + i.points, 0) ?? 0;
  const graded = attempt?.status === 'graded';
  const resumable = !!attempt && !graded;
  const startBtn = `inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${r.btnNeon} ${r.btnText}`;
  const ghostBtn = `inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold ${r.btnGhost}`;

  return (
    <>
      <section aria-labelledby="yeni-yazili" className={`p-5 sm:p-6 ${r.panel}`}>
        <p className={r.label}>Yapay zekâ kontrollü</p>
        <h2 id="yeni-yazili" className={`mt-1 text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>Yeni yazılı aç</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Okulunun MEB senaryosunu seç ya da dağılımı kendin ayarla; sorular havuzdan rastgele gelir. Cevaplarını yaz, yapay zekâ puanlasın ve neyi eksik bıraktığını söylesin.
          Günde 3 yazılı, reklamsız.
        </p>

        {authLoading ? null : !user ? (
          <Link href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className={`mt-4 inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
            Giriş yap ve başla
          </Link>
        ) : (
          <>
          {!resumable && (
            <PlanEditor
              loOptions={loOptions} scenarios={scenarios} scenarioCount={scenarioCount}
              scenario={scenario} plan={plan}
              onChange={(s, p) => { setScenario(s); setPlan(p); }}
            />
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {resumable ? (
              <button type="button" onClick={() => setModalOpen(true)} className={startBtn}>
                <PenLine className="h-4 w-4" aria-hidden="true" /> Yazılıya devam et
              </button>
            ) : (
              <button type="button" onClick={start} disabled={busy !== null || left === 0 || !plan.length} className={startBtn}>
                {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}
                Yazılıya başla
              </button>
            )}
            {graded && (
              <button type="button" onClick={() => setModalOpen(true)} className={ghostBtn}>
                Son sonucu gör · {fmt(attempt.totalScore ?? 0)} / {total}
              </button>
            )}
            {resumable && <span className="text-sm text-muted-foreground">Yarım kalan yazılın var.</span>}
            {!resumable && left != null && <span className="text-sm text-muted-foreground">{left > 0 ? `Bugün ${left} hakkın var` : 'Bugünkü hakkın doldu, yarın yeniden dene.'}</span>}
          </div>
          </>
        )}

        {!modalOpen && error && <p role="alert" className="mt-3 text-sm font-semibold text-red-500">{error}</p>}
      </section>

      {modalOpen && attempt && (
        <ExamModal
          title="Yazılı"
          subtitle={`${scenarioLabel(attempt.scenario)} · ${attempt.items.length} soru · ${total} puan`}
          onClose={() => setModalOpen(false)}
          closeDisabled={busy === 'grade'}
          footer={
            <>
              {error && <p role="alert" className="w-full text-sm font-semibold text-red-500">{error}</p>}
              {graded ? (
                <button type="button" onClick={() => setModalOpen(false)} disabled={left === 0} className={startBtn}>
                  <PenLine className="h-4 w-4" aria-hidden="true" /> Yeni yazılı aç
                </button>
              ) : (
                <button type="button" onClick={grade} disabled={busy !== null} className={startBtn}>
                  {busy === 'grade' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  {busy === 'grade' ? 'Kontrol ediliyor…' : 'Cevaplarımı kontrol et'}
                </button>
              )}
              <button type="button" onClick={() => setModalOpen(false)} disabled={busy === 'grade'} className={`${ghostBtn} disabled:opacity-50`}>
                {graded ? 'Kapat' : 'Sonra devam et'}
              </button>
              {graded && left === 0 && <span className="text-sm text-muted-foreground">Bugünkü hakkın doldu, yarın yeniden dene.</span>}
            </>
          }
        >
          {graded && (
            <div className={`mb-3 flex flex-wrap items-baseline gap-3 rounded-2xl p-4 ${r.item}`} role="status">
              <span className={`text-3xl font-bold ${r.accent} ${r.display}`}>{fmt(attempt.totalScore ?? 0)}</span>
              <span className="text-sm text-muted-foreground">/ {total} puan</span>
            </div>
          )}
          <AttemptItems items={attempt.items} answers={answers} graded={graded} locked={busy === 'grade'} onChange={setAnswer} photo={{ urls: photos, busyId: photoBusy, error: photoError, onPick: pickPhoto, onRemove: removePhoto }} />
        </ExamModal>
      )}

      {user && state && state.history.length > 0 && <PastAttempts history={state.history} ident={ident} />}
    </>
  );
}

// Dağılım seçici: senaryo çipleri + öğrenme çıktısı satırları (−/+/✕) + çıktı ekleme. Senaryoya birebir
// uymayan her plan "Kendi dağılımın" sayılır (sunucu da aynı kuralla karar verir).
function PlanEditor({ loOptions, scenarios, scenarioCount, scenario, plan, onChange }: PlanProps & {
  scenario: number | null; plan: [string, number][]; onChange: (scenario: number | null, plan: [string, number][]) => void;
}) {
  const byCode = new Map(loOptions.map((o) => [o.code, o]));
  const total = plan.reduce((n, [, c]) => n + c, 0);
  const official = scenario != null ? scenarioCounts(scenarios, scenario) : null;
  const matches = !!official && Object.keys(official).length === plan.length && plan.every(([c, n]) => official[c] === n);
  const clipped = !!official && !matches && initialPlan(loOptions, official).every(([c, n], i) => plan[i]?.[0] === c && plan[i]?.[1] === n);
  const addable = loOptions.filter((o) => o.pool > 0 && !plan.some(([c]) => c === o.code));
  const set = (next: [string, number][]) => onChange(scenario, next);
  const chip = (on: boolean) => `min-h-9 rounded-xl px-3 text-sm font-bold ${on ? `${r.btnNeon} ${r.btnText}` : r.btnGhost}`;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {scenarioCount > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Dağılım seç">
          {Array.from({ length: scenarioCount }, (_, i) => i + 1).map((s) => (
            <button key={s} type="button" aria-pressed={scenario === s} className={chip(scenario === s)} onClick={() => onChange(s, initialPlan(loOptions, scenarioCounts(scenarios, s)))}>
              {s}. senaryo
            </button>
          ))}
          <button type="button" aria-pressed={scenario === null} className={chip(scenario === null)} onClick={() => onChange(null, initialPlan(loOptions, null))}>
            Kendim seçeceğim
          </button>
        </div>
      )}
      <p className="text-sm">
        <b className="text-default">{matches ? scenarioLabel(scenario) : 'Kendi dağılımın'}</b>
        <span className="text-muted-foreground"> · {total} soru{total >= CUSTOM_MAX_TOTAL ? ` (en çok ${CUSTOM_MAX_TOTAL})` : ''}</span>
        {clipped && <span className="block text-xs text-muted-foreground">Bu senaryodaki bazı çıktılar için yeterli soru yok, sayılar azaltıldı.</span>}
      </p>
      <ul className="flex flex-col gap-2">
        {plan.map(([code, n], i) => {
          const o = byCode.get(code);
          return (
            <li key={code} className={`flex items-center gap-3 rounded-xl p-3 ${r.item}`}>
              <span className="min-w-0 flex-1 text-sm">
                <b className="text-default">{code}</b> <span className="text-default">{o?.title}</span>
                {!!o?.topicTitles.length && <span className="block text-xs text-muted-foreground">{o.topicTitles.join(', ')}</span>}
              </span>
              <button type="button" aria-label={`${code} bir soru azalt`} disabled={n <= 1} onClick={() => set(plan.map((p, j) => (j === i ? [code, n - 1] : p)))} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40 ${r.btnGhost}`}>
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-6 text-center font-bold text-default" aria-live="polite">{n}</span>
              <button type="button" aria-label={`${code} bir soru artır`} disabled={n >= (o?.pool ?? 0) || total >= CUSTOM_MAX_TOTAL} onClick={() => set(plan.map((p, j) => (j === i ? [code, n + 1] : p)))} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40 ${r.btnGhost}`}>
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label={`${code} çıkar`} onClick={() => set(plan.filter((_, j) => j !== i))} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${r.btnGhost}`}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {addable.length > 0 && total < CUSTOM_MAX_TOTAL && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Öğrenme çıktısı ekle
          <select
            value=""
            onChange={(e) => e.target.value && set([...plan, [e.target.value, 1] as [string, number]].sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true })))}
            className="min-h-9 max-w-full rounded-xl border border-[var(--edge)] bg-transparent px-2 text-sm text-default"
          >
            <option value="">Seç…</option>
            {addable.map((o) => <option key={o.code} value={o.code}>{o.code} {o.title}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

// Yazılı penceresi: dışına tıklayınca, Esc ile ya da X ile kapanır; arkadaki sayfa kaymaz.
function ExamModal({ title, subtitle, onClose, closeDisabled = false, footer, children }: {
  title: string; subtitle: string; onClose: () => void; closeDisabled?: boolean; footer?: ReactNode; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, closeDisabled]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !closeDisabled && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="yazili-pencere-baslik"
        className={`${r.themeVars} flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-3xl sm:rounded-2xl ${r.menu}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${r.divider}`}>
          <div className="min-w-0">
            <p className={r.label}>{subtitle}</p>
            <h2 id="yazili-pencere-baslik" className={`truncate text-lg font-bold ${r.display} ${r.ink}`}>{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Kapat" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 ${r.btnGhost}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className={`flex flex-wrap items-center gap-3 border-t px-5 py-4 ${r.divider}`}>{footer}</div>}
      </div>
    </div>
  );
}

type ItemsProps = {
  items: Item[];
  answers: Record<number, string>;
  graded: boolean;
  locked: boolean;
  onChange: (id: number, text: string) => void;
  /** Verilirse (puanlanmamış yazılı) her soruya fotoğraf ekleme düğmesi çıkar. */
  photo?: { urls: Record<number, string | null>; busyId: number | null; error: { id: number; message: string } | null; onPick: (id: number, file: File) => void; onRemove: (id: number) => void };
};

function AttemptItems({ items, answers, graded, locked, onChange, photo }: ItemsProps) {
  return (
    <ol className="flex flex-col gap-3">
                {items.map((it, i) => {
                  const svg = it.svg ? <YaziliSvg svgContent={it.svg} /> : null;
                  return (
                    <li key={it.id} className={`rounded-2xl p-4 sm:p-5 ${r.item}`}>
                      <div className="flex gap-3">
                        <span className={`h-8 w-8 shrink-0 text-sm ${r.chipBox}`} aria-hidden="true">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          {it.svgPosition === 'above' && svg}
                          <p className="leading-relaxed text-default">
                            <span className="sr-only">Soru {i + 1}: </span>
                            <span dangerouslySetInnerHTML={{ __html: it.textHtml }} />
                            <span className={`ml-2 whitespace-nowrap align-middle ${r.badge}`}>{it.points} puan</span>
                          </p>
                          {it.svgPosition === 'below' && svg}
                          <label className="sr-only" htmlFor={`cevap-${it.id}`}>Soru {i + 1} cevabın</label>
                          <textarea
                            id={`cevap-${it.id}`}
                            value={answers[it.id] ?? ''}
                            onChange={(e) => onChange(it.id, e.target.value)}
                            readOnly={graded || locked}
                            maxLength={MAX_LEN}
                            rows={4}
                            placeholder="Cevabını buraya yaz"
                            className="mt-3 w-full resize-y rounded-xl border border-[var(--edge)] bg-transparent p-3 text-sm text-default"
                          />
                          {(() => {
                            const imageUrl = photo && it.id in photo.urls ? photo.urls[it.id] : it.imageUrl;
                            return (
                              <>
                                {imageUrl && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imageUrl} alt={`Soru ${i + 1} için yüklediğin kâğıt fotoğrafı`} className="mt-3 max-h-72 w-auto max-w-full rounded-xl border border-[var(--edge)] bg-white" />
                                )}
                                {photo && !graded && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <label className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${r.btnGhost} ${locked || photo.busyId !== null ? 'pointer-events-none opacity-50' : ''}`}>
                                      {photo.busyId === it.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
                                      {imageUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) photo.onPick(it.id, f); }} />
                                    </label>
                                    {imageUrl && (
                                      <button type="button" onClick={() => photo.onRemove(it.id)} disabled={locked || photo.busyId !== null} className="text-sm font-semibold text-muted-foreground hover:underline disabled:opacity-50">
                                        Kaldır
                                      </button>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {it.asksDrawing ? 'Bu soruda çizim istenebilir: kâğıda çizip fotoğrafını ekle ya da çizimi yazıyla anlat.' : 'İşlem ya da çizimini kâğıda yazıp fotoğrafını ekleyebilirsin (isteğe bağlı).'}
                                    </span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {photo?.error?.id === it.id && !graded && <p role="alert" className="mt-1 text-xs font-semibold text-red-500">{photo.error.message}</p>}
                          {graded && (
                            <div className="mt-2 flex flex-col gap-2 border-t border-dashed border-[var(--edge)] pt-3 text-sm">
                              <p><b className={r.accent}>{fmt(it.score ?? 0)} / {it.points} puan.</b> <span className="text-default">{it.feedback}</span></p>
                              {it.answerHtml && <p><b className="text-default">Örnek cevap:</b> <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: it.answerHtml }} /></p>}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
  );
}

export type HistoryItem = { id: number; createdAt: string; scenario: number | null; totalScore: number; maxPoints: number };

// "Geçmiş yazılılarım": puanlanmış denemeler; birine tıklayınca cevaplar, puanlar ve geri bildirimler pencerede açılır.
function PastAttempts({ history, ident }: { history: HistoryItem[]; ident: { sinif: string; ders: string; yazili: string } }) {
  const [detail, setDetail] = useState<Attempt | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeDetail = useCallback(() => setDetail(null), []);

  const show = async (id: number) => {
    setLoadingId(id); setError(null);
    try {
      const res = await fetch(`/api/yazili/deneme/${id}?${new URLSearchParams(ident)}`);
      const json = await res.json();
      if (!res.ok) setError(json.error ?? 'Yazılı açılamadı');
      else setDetail(json.attempt);
    } catch {
      setError('Bağlantı hatası, tekrar dene.');
    }
    setLoadingId(null);
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const detailTotal = detail?.items.reduce((sum, i) => sum + i.points, 0) ?? 0;

  return (
    <section aria-labelledby="gecmis-yazililar" className={`p-5 sm:p-6 ${r.panel}`}>
      <p className={r.label}>Kayıtlı sonuçların</p>
      <h2 id="gecmis-yazililar" className={`mt-1 text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>Geçmiş yazılılarım</h2>
      <ul className="mt-4 flex flex-col gap-2">
        {history.map((h) => (
          <li key={h.id}>
            <button type="button" onClick={() => show(h.id)} disabled={loadingId !== null} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-left ${r.item}`}>
              <span className="text-sm text-default">
                {fmtDate(h.createdAt)}
                <span className="ml-2 text-xs text-muted-foreground">{scenarioLabel(h.scenario)}</span>
              </span>
              <span className="flex items-center gap-2">
                <b className={`${r.accent} ${r.display}`}>{fmt(h.totalScore)} / {h.maxPoints}</b>
                {loadingId === h.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-500">{error}</p>}

      {detail && (
        <ExamModal
          title={`${fmt(detail.totalScore ?? 0)} / ${detailTotal} puan`}
          subtitle={`${scenarioLabel(detail.scenario)} · ${detail.items.length} soru`}
          onClose={closeDetail}
        >
          <AttemptItems items={detail.items} answers={Object.fromEntries(detail.items.map((i) => [i.id, i.answer]))} graded locked onChange={() => {}} />
        </ExamModal>
      )}
    </section>
  );
}
