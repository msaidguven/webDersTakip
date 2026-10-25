'use client';

// Admin → Yazılı Soruları (bkz. docs/yazili-sorulari-plani.md). Seçim: sınıf → ders → yazılı. Kapsam MEB
// konu-soru dağılım tablosundan gelir (Excel yükle; senaryolar + konular), tablo yoksa yıllık plan haftasından
// öneri. Altta konu konu klasik soru üretimi: prompt kopyala → AI → JSON yapıştır → önizle → kaydet, ya da
// elle tek soru. Sorular konuya bağlı; yazılı yalnız kapsamı tutar.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_EXAM_WEEKS, TOPIC_QUESTION_TARGET, asksForDrawing, examLabel, type ExamNo, type ExamTerm } from '@/app/src/lib/yazili/common';
import type { WeekRange } from '@/app/src/lib/kazanimPlan';

type Pair = { gradeId: number; gradeName: string; lessonId: number; lessonName: string };
type ExamSummary = { gradeId: number; lessonId: number; term: number; examNo: number; status: 'draft' | 'published'; hasMeb: boolean };
type Outcome = { id: number; key: string; loCode: string | null; description: string; weeks: WeekRange[] };
type Topic = {
  id: number; title: string; unitTitle: string; span: WeekRange | null; loCodes: string[]; outcomes: Outcome[];
  classical: { total: number; svgPending: number; answerSvgPending: number; byOutcome: Record<number, number>; byLo: Record<string, number> };
};
type Target = { scenario: number; loCode: string; count: number };
type ExamData = {
  exam: { id: number; status: 'draft' | 'published'; national: boolean; examDate: string | null } | null;
  weekFrom: number; weekTo: number; selectedIds: number[]; targets: Target[]; topics: Topic[];
};
type ImportReport = { sheet: string; status: 'imported' | 'skipped'; reason?: string; addedLoCodes?: string[]; exams?: { examNo: number; national: boolean; scenarios: number; codes: number; topics: number; unmatched: string[] }[] };

const EXAMS: { term: ExamTerm; examNo: ExamNo }[] = [{ term: 1, examNo: 1 }, { term: 1, examNo: 2 }, { term: 2, examNo: 1 }, { term: 2, examNo: 2 }];
const ODSGM_URL = 'https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724';
const STORAGE_KEY = 'admin-yazili-secim';
// Görsel bekleyen klasik sorular: SVG Soruları ekranı, yalnız klasik sorular filtreli.
const SVG_PENDING_HREF = '/admin/svg-sorulari?tur=klasik';
const ANSWER_SVG_PENDING_HREF = '/admin/svg-sorulari?tur=cevap';

const btn = 'rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50';
const btnPrimary = 'rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50';
const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-accent'}`;
const input = 'rounded-lg border border-border bg-background px-2 py-1.5 text-sm';

function overlaps(span: WeekRange | null, from: number, to: number) {
  return !!span && span.start <= to && span.end >= from;
}

function countBadge(n: number) {
  if (n >= TOPIC_QUESTION_TARGET.min) return { text: `Tamam · ${n}`, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  return { text: `Yetersiz · ${n}`, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
}

function readStored(): { gradeId?: number; lessonId?: number; term?: ExamTerm; examNo?: ExamNo } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function YaziliPanel() {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [summaries, setSummaries] = useState<ExamSummary[]>([]);
  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [term, setTerm] = useState<ExamTerm>(1);
  const [examNo, setExamNo] = useState<ExamNo>(1);
  const [data, setData] = useState<ExamData | null>(null);
  const [weekFrom, setWeekFrom] = useState(1);
  const [weekTo, setWeekTo] = useState(8);
  const [examDate, setExamDate] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [openTopic, setOpenTopic] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Soru eklenince/kapsam değişince eksik havuz listesi yeniden çekilir.
  const [shortfallKey, setShortfallKey] = useState(0);

  const loadSummaries = useCallback(async () => {
    const d = (await (await fetch('/api/admin/yazili')).json()) as { pairs?: Pair[]; exams?: ExamSummary[] };
    setPairs(d.pairs ?? []);
    setSummaries(d.exams ?? []);
  }, []);

  useEffect(() => {
    const s = readStored();
    if (s.gradeId) setGradeId(s.gradeId);
    if (s.lessonId) setLessonId(s.lessonId);
    if (s.term) setTerm(s.term);
    if (s.examNo) setExamNo(s.examNo);
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ gradeId, lessonId, term, examNo }));
    } catch {
      // gizli pencere vb. — seçim hatırlanmaz, sorun değil
    }
  }, [gradeId, lessonId, term, examNo]);

  const grades = useMemo(() => [...new Map(pairs.map((p) => [p.gradeId, p.gradeName])).entries()], [pairs]);
  const lessons = pairs.filter((p) => p.gradeId === gradeId);
  const pair = lessons.find((p) => p.lessonId === lessonId) ?? null;
  const summaryOf = (lid: number, t: number, n: number) => summaries.find((s) => s.gradeId === gradeId && s.lessonId === lid && s.term === t && s.examNo === n);

  const load = useCallback(async () => {
    if (!gradeId || !lessonId) return;
    setData(null);
    setMsg(null);
    setOpenTopic(null);
    const res = await fetch(`/api/admin/yazili?gradeId=${gradeId}&lessonId=${lessonId}&term=${term}&examNo=${examNo}`);
    if (!res.ok) return;
    const d = (await res.json()) as ExamData;
    setData(d);
    setWeekFrom(d.weekFrom);
    setWeekTo(d.weekTo);
    setExamDate(d.exam?.examDate ?? '');
    setSelected(d.selectedIds);
    setShortfallKey((k) => k + 1);
  }, [gradeId, lessonId, term, examNo]);

  // Soru eklenip silinince yalnız sayılar tazelenir: açık konu paneli, kayıt mesajı ve kaydedilmemiş
  // konu seçimi yerinde kalır (tam yeniden yükleme paneli kapatıp "kaydedildi" mesajını yutuyordu).
  const refreshCounts = useCallback(async () => {
    if (!gradeId || !lessonId) return;
    const res = await fetch(`/api/admin/yazili?gradeId=${gradeId}&lessonId=${lessonId}&term=${term}&examNo=${examNo}`);
    if (!res.ok) return;
    const d = (await res.json()) as ExamData;
    setData((prev) => (prev ? { ...prev, topics: d.topics } : d));
    setShortfallKey((k) => k + 1);
  }, [gradeId, lessonId, term, examNo]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seçili konular yazılıdaki sırayla üstte; kalanlar katlanır listede.
  const selectedTopics = useMemo(
    () => selected.map((id) => data?.topics.find((t) => t.id === id)).filter((t): t is Topic => !!t),
    [data, selected]
  );
  const otherTopics = useMemo(() => (data?.topics ?? []).filter((t) => !selected.includes(t.id)), [data, selected]);
  const toggleTopic = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const scenarioCount = useMemo(() => Math.max(0, ...(data?.targets ?? []).map((t) => t.scenario)), [data]);
  const scenarioRows = useMemo(() => {
    const byCode = new Map<string, Record<number, number>>();
    for (const t of data?.targets ?? []) byCode.set(t.loCode, { ...(byCode.get(t.loCode) ?? {}), [t.scenario]: t.count });
    return [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }));
  }, [data]);
  const scenarioTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const t of data?.targets ?? []) totals[t.scenario] = (totals[t.scenario] ?? 0) + t.count;
    return totals;
  }, [data]);

  const save = async (status: 'draft' | 'published') => {
    if (!pair) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/admin/yazili', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradeId: pair.gradeId, lessonId: pair.lessonId, term, examNo, weekFrom, weekTo, topicIds: selected, status, examDate: examDate || null }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) return setMsg(d.error ?? 'Kaydedilemedi');
    setMsg(status === 'published' ? 'Yayınlandı.' : 'Taslak kaydedildi.');
    void load();
    void loadSummaries();
  };

  const hasMeb = (data?.targets.length ?? 0) > 0;
  const national = !!data?.exam?.national;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 text-foreground">
      <ImportCard onImported={() => { void loadSummaries(); void load(); setShortfallKey((k) => k + 1); }} />
      <ShortfallCard
        refreshKey={shortfallKey}
        onOpen={(row) => {
          setGradeId(row.gradeId);
          setLessonId(row.lessonId);
          setTerm(row.term as ExamTerm);
          setExamNo(row.examNo as ExamNo);
        }}
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4" aria-label="Yazılı seçimi">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 · Sınıf</span>
          <div className="flex flex-wrap gap-2">
            {grades.map(([id, name]) => (
              <button key={id} type="button" className={chip(gradeId === id)} aria-pressed={gradeId === id} onClick={() => { setGradeId(id); setLessonId(null); }}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {gradeId && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 · Ders</span>
            <div className="flex flex-wrap gap-2">
              {lessons.map((p) => {
                const meb = summaries.some((s) => s.gradeId === gradeId && s.lessonId === p.lessonId && s.hasMeb);
                return (
                  <button key={p.lessonId} type="button" className={chip(lessonId === p.lessonId)} aria-pressed={lessonId === p.lessonId} onClick={() => setLessonId(p.lessonId)}>
                    {p.lessonName}
                    {meb && <span className="ml-1.5 text-xs opacity-80" title="MEB dağılım tablosu yüklü">· MEB</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {pair && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3 · Yazılı</span>
            <div className="flex flex-wrap gap-2">
              {EXAMS.map((e) => {
                const s = summaryOf(pair.lessonId, e.term, e.examNo);
                const on = term === e.term && examNo === e.examNo;
                return (
                  <button key={`${e.term}-${e.examNo}`} type="button" className={chip(on)} aria-pressed={on} onClick={() => { setTerm(e.term); setExamNo(e.examNo); }}>
                    {examLabel(e.term, e.examNo)}
                    {s && <span className="ml-1.5 text-xs opacity-80">· {s.status === 'published' ? 'Yayında' : 'Taslak'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {pair && !data && <div className="h-40 animate-pulse rounded-2xl bg-muted" aria-busy="true" />}

      {pair && data && (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-base font-bold">
                {pair.gradeName} {pair.lessonName} · {examLabel(term, examNo)}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${data.exam?.status === 'published' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  {data.exam ? (data.exam.status === 'published' ? 'Yayında' : 'Taslak') : 'Kaydedilmedi'}
                </span>
              </h2>
              <label className="flex items-center gap-2 text-sm">
                Sınav tarihi
                <input type="date" className={input} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </label>
            </div>
            {national ? (
              <p className="rounded-lg bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300">
                <b>Ülke geneli ortak sınav.</b> Soru kitapçığı Bakanlıkça gönderilir, senaryo yoktur. MEB tablosu kapsamı vermiyor — konuları aşağıdan elle seç.
              </p>
            ) : hasMeb ? (
              <p className="text-sm text-muted-foreground">Konular ve senaryolar MEB konu-soru dağılım tablosundan geldi. Konu listesini değiştirebilirsin (yeniden içe aktarma listeyi sıfırlar).</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                MEB tablosu yok — konular yıllık plan haftasından önerilir:
                <input type="number" min={1} max={40} className={`${input} w-16`} value={weekFrom} onChange={(e) => setWeekFrom(Number(e.target.value))} aria-label="Başlangıç haftası" />–
                <input type="number" min={1} max={40} className={`${input} w-16`} value={weekTo} onChange={(e) => setWeekTo(Number(e.target.value))} aria-label="Bitiş haftası" />
                <button type="button" className={btn} onClick={() => setSelected(data.topics.filter((t) => overlaps(t.span, weekFrom, weekTo)).map((t) => t.id))}>
                  Haftalardan öner
                </button>
                <button type="button" className={btn} onClick={() => { const d = DEFAULT_EXAM_WEEKS[`${term}-${examNo}`]; setWeekFrom(d.from); setWeekTo(d.to); }}>
                  Varsayılan hafta
                </button>
              </div>
            )}
          </section>

          {hasMeb && (
            <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">MEB senaryoları (öğrenme çıktısı başına soru)</h3>
              <p className="text-xs text-muted-foreground">
                Havuz: o öğrenme çıktısındaki klasik soru sayısı. İki farklı kağıt çıkabilmesi için en az &quot;en çok × 2&quot; olmalı.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-semibold">Öğrenme çıktısı</th>
                      {Array.from({ length: scenarioCount }, (_, i) => <th key={i} className="px-1 text-center font-semibold">S{i + 1}</th>)}
                      <th className="px-2 text-center font-semibold">Havuz</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioRows.map(([code, counts]) => {
                      const topicsOf = data.topics.filter((t) => t.loCodes.includes(code));
                      const pool = topicsOf.reduce((sum, t) => sum + (t.classical.byLo[code] ?? 0), 0);
                      const need = Math.max(...Object.values(counts)) * 2;
                      return (
                        <tr key={code} className="border-t border-border">
                          <td className="py-1.5 pr-3">
                            <b>{code}</b>
                            <span className="ml-2 text-xs text-muted-foreground">{topicsOf.map((t) => t.title).join(', ') || 'sitede konusu yok'}</span>
                          </td>
                          {Array.from({ length: scenarioCount }, (_, i) => <td key={i} className="px-1 text-center">{counts[i + 1] ?? '·'}</td>)}
                          <td className={`px-2 text-center font-semibold ${pool >= need ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`} title={`En az ${need} önerilir`}>
                            {pool}/{need}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border text-xs text-muted-foreground">
                      <td className="py-1.5 pr-3">Toplam soru</td>
                      {Array.from({ length: scenarioCount }, (_, i) => <td key={i} className="px-1 text-center">{scenarioTotals[i + 1] ?? 0}</td>)}
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Yazılının konuları ({selected.length})</h3>
            {selectedTopics.length ? (
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {selectedTopics.map((t) => (
                  <TopicRow key={t.id} topic={t} on open={openTopic === t.id} onToggle={toggleTopic} onOpen={setOpenTopic} onChanged={() => void refreshCounts()} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Henüz konu seçilmedi — aşağıdan ekle.</p>
            )}
            {otherTopics.length > 0 && (
              <details className="rounded-xl border border-border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Diğer konular ({otherTopics.length}) — yazılıya eklemek için işaretle</summary>
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {otherTopics.map((t) => (
                    <TopicRow key={t.id} topic={t} on={false} open={openTopic === t.id} onToggle={toggleTopic} onOpen={setOpenTopic} onChanged={() => void refreshCounts()} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background/95 py-3 backdrop-blur">
            <button type="button" className={btn} disabled={saving} onClick={() => void save('draft')}>
              Taslak kaydet
            </button>
            <button type="button" className={btnPrimary} disabled={saving || !selected.length} onClick={() => void save('published')}>
              Yayınla
            </button>
            {msg && <span className="text-sm" role="status">{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function TopicRow({ topic: t, on, open, onToggle, onOpen, onChanged }: {
  topic: Topic; on: boolean; open: boolean; onToggle: (id: number) => void; onOpen: (id: number | null) => void; onChanged: () => void;
}) {
  const badge = countBadge(t.classical.total);
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <input type="checkbox" checked={on} onChange={() => onToggle(t.id)} aria-label={`${t.title} yazılıya dahil`} />
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{t.title}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {t.unitTitle} · {t.span ? `${t.span.start}–${t.span.end}. hafta` : 'hafta yok'}
          {t.loCodes.length ? ` · ${t.loCodes.join(', ')}` : ''}
        </span>
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
      {t.classical.svgPending > 0 && (
        <a href={SVG_PENDING_HREF} className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400" title="Görseli eklenince yayına girer ve havuza sayılır">
          +{t.classical.svgPending} çizim bekliyor
        </a>
      )}
      {t.classical.answerSvgPending > 0 && (
        <a href={ANSWER_SVG_PENDING_HREF} className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400" title="Soru yayında; cevap görseli yalnız cevap anahtarını tamamlar">
          {t.classical.answerSvgPending} cevap görseli bekliyor
        </a>
      )}
      <button type="button" className={btn} onClick={() => onOpen(open ? null : t.id)} aria-expanded={open}>
        {open ? 'Kapat' : 'Sorular'}
      </button>
      {open && <TopicQuestions topic={t} onChanged={onChanged} />}
    </li>
  );
}

type ShortfallRow = {
  examId: number; gradeId: number; lessonId: number; term: number; examNo: number; title: string;
  status: string; national: boolean; examDate: string | null; totalCodes: number;
  missing: { loCode: string; needed: number; have: number }[];
};

function ShortfallCard({ refreshKey, onOpen }: { refreshKey: number; onOpen: (row: ShortfallRow) => void }) {
  const [rows, setRows] = useState<ShortfallRow[] | null>(null);
  const [svgPending, setSvgPending] = useState(0);
  const [answerSvgPending, setAnswerSvgPending] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/yazili/shortfall')
      .then((r) => r.json())
      .then((d: { rows?: ShortfallRow[]; svgPending?: number; answerSvgPending?: number }) => {
        if (cancelled) return;
        setRows(d.rows ?? []);
        setSvgPending(d.svgPending ?? 0);
        setAnswerSvgPending(d.answerSvgPending ?? 0);
      })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <details className="rounded-2xl border border-border bg-card p-4" open>
      <summary className="cursor-pointer text-sm font-bold">
        Eksik havuz {rows ? `(${rows.length} yazılı)` : ''}
      </summary>
      {svgPending > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-sky-500/10 p-3 text-sm text-sky-700 dark:text-sky-300">
          <span><b>{svgPending} yazılı sorusu görsel (SVG) bekliyor.</b> Görsel eklenene kadar taslakta kalır; sayfada ve kağıtlarda görünmez, havuza sayılmaz.</span>
          <a href={SVG_PENDING_HREF} className="font-bold underline">Görselleri ekle →</a>
        </p>
      )}
      {answerSvgPending > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-violet-500/10 p-3 text-sm text-violet-700 dark:text-violet-300">
          <span><b>{answerSvgPending} cevap görseli bekliyor.</b> Sorular yayında ve havuza sayılıyor; görsel yalnız cevap anahtarını tamamlar.</span>
          <a href={ANSWER_SVG_PENDING_HREF} className="font-bold underline">Cevap görsellerini ekle →</a>
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        A ve B kağıdı çıkabilmesi için öğrenme çıktısı başına gereken klasik soru (senaryolardaki en çok sayı × 2). Sınav tarihi yakın olan üstte.
      </p>
      {rows === null ? (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Tüm yazılıların havuzu yeterli.</p>
      ) : (
        <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto">
          {rows.map((row) => {
            const missingTotal = row.missing.reduce((n, m) => n + (m.needed - m.have), 0);
            return (
              <li key={row.examId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{row.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.examDate ? new Date(`${row.examDate}T12:00:00+03:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : 'tarih yok'}
                    {row.national ? ' · ülke geneli' : ''} · {row.status === 'published' ? 'yayında' : 'taslak'}
                  </span>
                  <span className="mt-0.5 block text-xs">
                    <b className="text-red-500">{missingTotal} soru eksik</b>
                    <span className="text-muted-foreground"> · {row.missing.map((m) => `${m.loCode} ${m.have}/${m.needed}`).join(' · ')}</span>
                  </span>
                </span>
                <button type="button" className={btn} onClick={() => onOpen(row)}>Aç</button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

function ImportCard({ onImported }: { onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport[] | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setReport(null);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/yazili/import', { method: 'POST', body: form });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? 'İçe aktarılamadı');
    setReport(d.report);
    onImported();
  };

  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-bold">MEB konu-soru dağılım tablosu yükle (.xlsx)</summary>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          ÖDSGM&apos;nin ders Excel&apos;ini yükle (<a className="underline" href={ODSGM_URL} target="_blank" rel="noopener noreferrer">tablolar sayfası</a>).
          Sitedeki her sınıf için o dersin 1. ve 2. yazılı senaryoları ve konuları güncellenir; durum ve tarih korunur.
        </p>
        <input type="file" accept=".xlsx" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        {busy && <span role="status">Yükleniyor…</span>}
        {error && <p role="alert" className="font-semibold text-red-500">{error}</p>}
        {report && (
          <ul className="flex flex-col gap-1">
            {report.map((r) => (
              <li key={r.sheet}>
                <b>{r.sheet}</b>:{' '}
                {r.status === 'skipped'
                  ? <span className="text-muted-foreground">atlandı ({r.reason})</span>
                  : r.exams?.map((e) => (
                    <span key={e.examNo} className="mr-3">
                      {e.examNo}. yazılı — {e.national ? 'ülke geneli' : `${e.scenarios} senaryo, ${e.codes} öğrenme çıktısı, ${e.topics} konu`}
                      {e.unmatched.length > 0 && <span className="text-red-500"> · eşleşmeyen: {e.unmatched.join(', ')}</span>}
                    </span>
                  ))}
                {!!r.addedLoCodes?.length && <span className="text-sky-600"> · kodu eksik konulara eklendi: {r.addedLoCodes.join(', ')}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

type PreviewItem = {
  questionText: string;
  modelAnswer: string;
  keyTerms: string[];
  svgPrompt: string | null;
  answerSvgPrompt: string | null;
  rubric: string | null;
  outcomeKey: string | null;
  rawCode: string;
  difficulty: number;
};
type SavedQuestion = { id: number; questionText: string; difficulty: number | null; isActive: boolean; svgPending: boolean; modelAnswer: string; keyTerms: string[]; rubric: string | null; outcomeIds: number[] };

function TopicQuestions({ topic, onChanged }: { topic: Topic; onChanged: () => void }) {
  const [source, setSource] = useState<'content' | 'questions'>('content');
  const [compact, setCompact] = useState(false);
  const [promptInfo, setPromptInfo] = useState<string | null>(null);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  // Önizlemede kodu tanınmayan soru için elle seçilen kazanım (soru sırası → kazanım anahtarı).
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  // Önizlemede kaldırılan cevap görseli tarifleri (soru sırası); çizim istemeyen soruda AI gereksiz yazmış olabilir.
  const [droppedAnswerSvg, setDroppedAnswerSvg] = useState<Record<number, true>>({});
  const [saveInfo, setSaveInfo] = useState<{ saved: number; svgPending: number; answerSvgPending: number } | null>(null);
  const [list, setList] = useState<SavedQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const res = await fetch(`/api/admin/yazili/questions?topicId=${topic.id}`);
    const d = await res.json();
    setList(d.questions ?? []);
  }, [topic.id]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const copyPrompt = async () => {
    setError(null);
    setPromptInfo(null);
    const res = await fetch(`/api/admin/yazili/prompt?topicId=${topic.id}&source=${source}${compact ? '&compact=1' : ''}`);
    const d = await res.json();
    if (!res.ok) return setError(d.error);
    await navigator.clipboard.writeText(d.prompt);
    setPromptInfo(`Kopyalandı · ${d.length.toLocaleString('tr-TR')} karakter${d.existingCount ? ` · mevcut ${d.existingCount} soru tekrar edilmeyecek` : ''}`);
  };

  const send = async (payload: unknown, dryRun: boolean) => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/yazili/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicId: topic.id, payload, dryRun }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error);
      return null;
    }
    return d;
  };

  const parseJson = () => {
    // AI cevabı çoğu zaman ```json bloğu ya da açıklama metniyle gelir: ilk "{" ile son "}" arası alınır.
    const text = json.trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    try {
      return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
    } catch {
      setError('JSON okunamadı — AI cevabındaki { "questions": [...] } bloğunu eksiksiz yapıştır.');
      return null;
    }
  };

  const doPreview = async () => {
    setSaveInfo(null);
    setOverrides({});
    setDroppedAnswerSvg({});
    const payload = parseJson();
    if (!payload) return;
    const d = await send(payload, true);
    if (d) setPreview(d.items);
  };

  const unresolved = preview ? preview.filter((p, i) => !p.outcomeKey && !overrides[i]).length : 0;

  const doSave = async () => {
    const payload = parseJson() as { questions?: Record<string, unknown>[] } | null;
    if (!payload) return;
    if (Array.isArray(payload.questions)) {
      payload.questions = payload.questions.map((q, i) => ({
        ...q,
        ...(overrides[i] ? { outcome_code: overrides[i] } : {}),
        ...(droppedAnswerSvg[i] ? { answer_svg_prompt: null } : {}),
      }));
    }
    const d = await send(payload, false);
    if (!d) return;
    setJson('');
    setPreview(null);
    setOverrides({});
    setDroppedAnswerSvg({});
    setSaveInfo({ saved: d.saved, svgPending: d.svgPending, answerSvgPending: d.answerSvgPending ?? 0 });
    void loadList();
    onChanged();
  };

  const remove = async (id: number) => {
    if (!confirm('Bu soru silinsin mi?')) return;
    await fetch('/api/admin/manage/questions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) });
    void loadList();
    onChanged();
  };

  const keyOf = (ids: number[]) => topic.outcomes.filter((o) => ids.includes(o.id)).map((o) => o.key).join(', ') || '—';

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={input} value={source} onChange={(e) => setSource(e.target.value as 'content' | 'questions')} aria-label="Kaynak">
          <option value="content">İçerikten</option>
          <option value="questions">Mevcut sorulardan</option>
        </select>
        {source === 'content' && (
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} /> Kısa (alt başlık özetleri)
          </label>
        )}
        <button type="button" className={btnPrimary} onClick={() => void copyPrompt()}>
          Prompt kopyala
        </button>
        {promptInfo && <span className="text-xs text-muted-foreground" role="status">{promptInfo}</span>}
      </div>

      <textarea
        className={`${input} min-h-32 font-mono text-xs`}
        placeholder="AI'dan dönen JSON'u buraya yapıştır"
        value={json}
        onChange={(e) => {
          setJson(e.target.value);
          setPreview(null);
          setSaveInfo(null);
        }}
      />
      {!preview && (
        <button type="button" className={`${btnPrimary} w-fit`} disabled={!json.trim() || busy} onClick={() => void doPreview()}>
          {busy ? 'Kontrol ediliyor…' : '1 · Kontrol et'}
        </button>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      {saveInfo && (
        <p role="status" className="rounded-lg bg-emerald-500/15 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          ✓ {saveInfo.saved} soru kaydedildi.
          {saveInfo.svgPending > 0 && (
            <> {saveInfo.svgPending} soru görsel bekliyor — <a href={SVG_PENDING_HREF} className="underline">SVG ekle</a>.</>
          )}
          {saveInfo.answerSvgPending > 0 && (
            <> {saveInfo.answerSvgPending} cevap görseli bekliyor (soru yayında) — <a href={ANSWER_SVG_PENDING_HREF} className="underline">cevap görseli ekle</a>.</>
          )}
        </p>
      )}

      {preview && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/15 p-3 text-sm">
          <span className="flex-1 font-semibold text-amber-800 dark:text-amber-200">
            Önizleme — henüz KAYDEDİLMEDİ. {preview.length} soru
            {unresolved > 0 ? ` · ${unresolved} sorunun kazanımını aşağıdan seç` : ''}
          </span>
          <button type="button" className={btn} disabled={busy} onClick={() => { setPreview(null); setOverrides({}); setDroppedAnswerSvg({}); }}>
            Vazgeç
          </button>
          <button type="button" className={btnPrimary} disabled={busy || unresolved > 0} onClick={() => void doSave()}>
            {busy ? 'Kaydediliyor…' : `2 · ${preview.length} soruyu kaydet`}
          </button>
        </div>
      )}

      {preview && (
        <ol className="flex flex-col gap-2">
          {preview.map((p, i) => (
            <li key={i} className={`rounded-lg border p-2 text-sm ${p.outcomeKey || overrides[i] ? 'border-border' : 'border-red-500 bg-red-500/10'}`}>
              <div className="font-semibold">{i + 1}. {p.questionText}</div>
              <div className="text-muted-foreground">Cevap: {p.modelAnswer}</div>
              {p.rubric ? <div className="whitespace-pre-line text-xs text-muted-foreground">{p.rubric}</div> : <div className="text-xs font-semibold text-amber-600">Rubrik yok</div>}
              {!p.outcomeKey && (
                <label className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  Kazanım kodu tanınmadı{p.rawCode ? ` ("${p.rawCode}")` : ''} — seç:
                  <select className={input} value={overrides[i] ?? ''} onChange={(e) => setOverrides((o) => ({ ...o, [i]: e.target.value }))}>
                    <option value="">Seç…</option>
                    {topic.outcomes.map((o) => (
                      <option key={o.id} value={o.key}>{o.key}) {o.description.slice(0, 70)}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="text-xs text-muted-foreground">
                Kazanım: {p.outcomeKey ?? overrides[i] ?? '—'} · Zorluk {p.difficulty}
                {p.keyTerms.length ? ` · ${p.keyTerms.join(', ')}` : ''}
                {p.svgPrompt ? ' · görsel istiyor' : ''}
              </div>
              {p.answerSvgPrompt && !droppedAnswerSvg[i] && (
                <div className={`mt-1 flex flex-wrap items-center gap-2 text-xs ${asksForDrawing(p.questionText) ? 'text-muted-foreground' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>
                  <span className="min-w-0 flex-1">
                    {asksForDrawing(p.questionText) ? 'Cevap görseli: ' : '⚠ Soru çizim istemiyor ama cevap görseli tarifi var: '}
                    {p.answerSvgPrompt}
                  </span>
                  <button type="button" className={btn} onClick={() => setDroppedAnswerSvg((d) => ({ ...d, [i]: true }))}>
                    Cevap görselini kaldır
                  </button>
                </div>
              )}
              {p.answerSvgPrompt && droppedAnswerSvg[i] && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Cevap görseli kaldırıldı ·{' '}
                  <button type="button" className="underline" onClick={() => setDroppedAnswerSvg((d) => { const next = { ...d }; delete next[i]; return next; })}>geri al</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <ManualAdd topic={topic} onSaved={() => { void loadList(); onChanged(); }} />

      <div>
        <h4 className="mb-2 text-sm font-bold">Kayıtlı klasik sorular ({list?.length ?? '…'})</h4>
        <ol className="flex flex-col gap-2">
          {(list ?? []).map((q, i) => (
            <SavedRow key={q.id} index={i} q={q} outcomeLabel={keyOf(q.outcomeIds)} onDelete={() => void remove(q.id)} onSaved={() => void loadList()} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function SavedRow({ index, q, outcomeLabel, onDelete, onSaved }: { index: number; q: SavedQuestion; outcomeLabel: string; onDelete: () => void; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.questionText);
  const [answer, setAnswer] = useState(q.modelAnswer);
  const [terms, setTerms] = useState(q.keyTerms.join(', '));
  const [difficulty, setDifficulty] = useState(q.difficulty ?? 3);
  const [rubric, setRubric] = useState(q.rubric ?? '');

  const save = async () => {
    const res = await fetch('/api/admin/manage/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: q.id,
        patch: { question_text: text.trim(), difficulty },
        classical: { model_answer: answer.trim(), key_terms: terms.split(',').map((t) => t.trim()).filter(Boolean), rubric },
      }),
    });
    if (res.ok) {
      setEditing(false);
      onSaved();
    }
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-sm">
        <textarea className={input} value={text} onChange={(e) => setText(e.target.value)} aria-label="Soru" />
        <textarea className={input} value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Cevap" />
        <input className={input} value={terms} onChange={(e) => setTerms(e.target.value)} aria-label="Anahtar kavramlar (virgülle)" />
        <textarea className={input} value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder={'Tam puan: …\nKısmi puan: …'} aria-label="Puanlama ölçütü (rubrik)" />
        <div className="flex gap-2">
          <select className={input} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} aria-label="Zorluk">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Zorluk {n}</option>)}
          </select>
          <button type="button" className={btnPrimary} onClick={() => void save()}>Kaydet</button>
          <button type="button" className={btn} onClick={() => setEditing(false)}>Vazgeç</button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 rounded-lg border border-border bg-card p-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{index + 1}. {q.questionText}</div>
        <div className="text-muted-foreground">Cevap: {q.modelAnswer}</div>
        {q.rubric && <div className="whitespace-pre-line text-xs text-muted-foreground">{q.rubric}</div>}
        <div className="text-xs text-muted-foreground">
          Kazanım: {outcomeLabel} · Zorluk {q.difficulty ?? '—'}
          {q.svgPending ? (
            <> · <a href={SVG_PENDING_HREF} className="font-semibold text-sky-600 hover:underline dark:text-sky-400">çizim bekliyor → SVG ekle</a></>
          ) : !q.isActive ? ' · pasif' : ''}
        </div>
      </div>
      <button type="button" className={btn} onClick={() => setEditing(true)}>Düzenle</button>
      <button type="button" className={btn} onClick={onDelete}>Sil</button>
    </li>
  );
}

function ManualAdd({ topic, onSaved }: { topic: Topic; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState('');
  const [terms, setTerms] = useState('');
  const [rubricFull, setRubricFull] = useState('');
  const [rubricPartial, setRubricPartial] = useState('');
  const [outcome, setOutcome] = useState(topic.outcomes[0]?.key ?? '');
  const [difficulty, setDifficulty] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const res = await fetch('/api/admin/yazili/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: topic.id,
        payload: {
          questions: [{
            type: 'classical', question_text: text, model_answer: answer, outcome_code: outcome, difficulty,
            key_terms: terms.split(',').map((t) => t.trim()).filter(Boolean),
            rubric: { full: rubricFull, partial: rubricPartial },
          }],
        },
      }),
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error);
    setText('');
    setAnswer('');
    setTerms('');
    setRubricFull('');
    setRubricPartial('');
    onSaved();
  };

  if (!open) {
    return (
      <button type="button" className={`${btn} w-fit`} onClick={() => setOpen(true)}>
        + Elle soru ekle
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 text-sm">
      <textarea className={input} placeholder="Soru" value={text} onChange={(e) => setText(e.target.value)} />
      <textarea className={input} placeholder="Cevap (kısa)" value={answer} onChange={(e) => setAnswer(e.target.value)} />
      <input className={input} placeholder="Anahtar kavramlar (virgülle)" value={terms} onChange={(e) => setTerms(e.target.value)} />
      <input className={input} placeholder="Tam puan ölçütü" value={rubricFull} onChange={(e) => setRubricFull(e.target.value)} />
      <input className={input} placeholder="Kısmi puan ölçütü (isteğe bağlı)" value={rubricPartial} onChange={(e) => setRubricPartial(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <select className={`${input} max-w-xs`} value={outcome} onChange={(e) => setOutcome(e.target.value)} aria-label="Kazanım">
          {topic.outcomes.map((o) => (
            <option key={o.id} value={o.key}>{o.key}) {o.description.slice(0, 60)}</option>
          ))}
        </select>
        <select className={input} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} aria-label="Zorluk">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Zorluk {n}</option>)}
        </select>
        <button type="button" className={btnPrimary} disabled={!text.trim() || !answer.trim()} onClick={() => void save()}>Ekle</button>
        <button type="button" className={btn} onClick={() => setOpen(false)}>Kapat</button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
    </div>
  );
}
