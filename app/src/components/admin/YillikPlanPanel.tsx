'use client';

// Yıllık Plan Yükleme — DOCX yıllık plan tablosunu okuyup Üniteler/Konular/Kazanımlar
// olarak Supabase'e aktarır. Eski yillik_plan/ (Python/Flask) aracının React portu;
// topic_contents'e hiç dokunmaz — bkz. app/src/lib/yillikPlan/importer.ts üstündeki not.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { TymmUnit, TymmRawSections } from '@/app/src/lib/tymm/tymmParser';

type ParsedRow = {
  week_no: number | null;
  Hafta: string;
  ünite: string;
  konu: string;
  kazanım: string[];
  saat: number | null;
};

// Tablo satırlarını index yerine kalıcı bir _id ile takip ediyoruz: satır silindiğinde
// React DOM node'larını index'e göre eşleştirip (defaultValue'lu, kontrolsüz inputlarla
// birleşince) yanlış satırın içeriğini gösterebiliyordu — sanki farklı bir satır
// silinmiş gibi görünüyordu. _id, React key'i olarak kullanılınca her satırın kendi DOM
// node'u kalıyor, silme her zaman doğru satırı hedefliyor. Sunucuya gönderilmeden önce
// _id ayıklanıyor (API sadece ParsedRow şeklini bekliyor).
type EditableRow = ParsedRow & { _id: number };

type LogLevel = 'info' | 'success' | 'warning' | 'error';
type LogEntry = { msg: string; level: LogLevel };
type StepResult = { basarili: number; atlanmis: number; hata: number; hafta_atlanmis?: number };
type StepKey = 'units' | 'topics' | 'outcomes';

type LessonRow = { id: number; name: string };
type GradeRow = { id: number; name: string };

// SADECE ÇEKME (yazma yok) sonucu — admin bunu düzenleyip onayladıktan sonra ayrı bir
// istekle (save) kaydedilir, bkz. Card 4 üstündeki not.
type TymmFetchResult = { unit: TymmUnit; unmatchedLines: string[]; rawSections: TymmRawSections };

// DB'YE YAZMA sonucu
type TymmImportResult = {
  ok: true;
  unitId: number;
  unitTitle: string;
  topicsCreated: number;
  outcomesCreated: number;
  outcomesSkipped: number;
};

type BulkFetchItem =
  | { url: string; title: string; ok: true; unit: TymmUnit; unmatchedLines: string[]; rawSections: TymmRawSections }
  | { url: string; title: string; ok: false; error: string };
type BulkFetchResponse = { unitsFound: number; results: BulkFetchItem[] };

// Toplu modda her ünite kendi bağımsız önizleme/düzenleme/kaydetme durumunu taşır — bir
// ünitenin kaydedilmesi diğerlerini etkilemez, hiçbiri admin tıklamadan kaydedilmez.
type BulkPreviewItem = {
  url: string;
  title: string;
  unit: TymmUnit | null;
  unmatchedLines: string[];
  rawSections: TymmRawSections | null;
  fetchError: string | null;
  collapsed: boolean;
  saving: boolean;
  saveResult: TymmImportResult | null;
  saveErr: string | null;
};

type WeekAssignResult =
  | { ok: true; assignments: { outcomeId: number; startWeek: number; endWeek: number }[] }
  | { ok: false; reason: 'no-docx-rows'; uniteName: string }
  | { ok: false; reason: 'topic-count-mismatch'; tymmCount: number; docxCount: number; dbTopicTitles: string[]; docxTitles: string[] }
  | { ok: false; reason: 'outcome-count-mismatch'; topicIndex: number; dbTopicTitle: string; dbCount: number; docxTopicTitle: string; docxCount: number };

type MatchPreviewTopic = {
  topicId: number;
  topicTitle: string;
  outcomes: { id: number; code: string | null; description: string; startWeek: number; endWeek: number }[];
};
type MatchPreviewResponse = { unitTitle: string; result: WeekAssignResult; preview: MatchPreviewTopic[] | null };
type CommitWeeksResponse = { ok: true; weeksWritten: number };

type UnitContentResponse = {
  unit: { id: number; title: string; duration_hours: number | null; key_concepts: string[] | null };
  topics: {
    id: number;
    title: string;
    learningOutcome: string | null;
    outcomes: { id: number; code: string | null; description: string }[];
  }[];
};

type InspectTarget = { unitId: number; tymmUrl: string; unitTitle: string };

const STEP_ENDPOINTS: Record<StepKey, string> = {
  units: '/api/admin/yillik-plan/import-units',
  topics: '/api/admin/yillik-plan/import-topics',
  outcomes: '/api/admin/yillik-plan/import-outcomes',
};

export default function YillikPlanPanel() {
  // Karışık görünmesin diye üç ayrı iş akışı sekmelere ayrıldı — DOCX yükleme ve Ders/Sınıf
  // seçimi ise her sekmede kullanıldığı için sekmelerin dışında, hep görünür kalıyor.
  const [activeTab, setActiveTab] = useState<'docx' | 'tymm' | 'weeks'>('docx');

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [gradeId, setGradeId] = useState<number | null>(null);

  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const nextRowId = useRef(0);
  const withIds = useCallback((list: ParsedRow[]): EditableRow[] => list.map((r) => ({ ...r, _id: nextRowId.current++ })), []);
  const [uniteler, setUniteler] = useState<string[]>([]);
  const [konuCount, setKonuCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  const [stepLogs, setStepLogs] = useState<Record<StepKey, LogEntry[]>>({ units: [], topics: [], outcomes: [] });
  const [stepResult, setStepResult] = useState<Record<StepKey, StepResult | null>>({ units: null, topics: null, outcomes: null });
  const [stepRunning, setStepRunning] = useState<Record<StepKey, boolean>>({ units: false, topics: false, outcomes: false });

  // TYMM'den Aktar sekmesi (bağımsız): TYMM'den içerik ÇEK (yazma yok) → önizle/düzelt → elle ONAYLA (o
  // zaman kaydedilir). Aynı ünite iki farklı curriculum_year ile art arda "aktarılınca"
  // (fetch+save tek adımdı) mükerrer kazanım oluşmuştu — artık kaydetme adımı ayrı ve
  // admin'in tıkladığı tek bir istek, bu yüzden yanlışlıkla iki kez tetiklenemiyor.
  const [tymmBulkMode, setTymmBulkMode] = useState(false);
  const [tymmUrl, setTymmUrl] = useState('');
  const [tymmYear, setTymmYear] = useState('2026-2027');

  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [previewUnit, setPreviewUnit] = useState<TymmUnit | null>(null);
  const [previewUnmatched, setPreviewUnmatched] = useState<string[]>([]);
  const [previewRawSections, setPreviewRawSections] = useState<TymmRawSections | null>(null);
  const [comparePreviewOpen, setComparePreviewOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<(TymmImportResult & { sourceUrl: string }) | null>(null);

  const [bulkPageUrl, setBulkPageUrl] = useState('');
  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkFetchErr, setBulkFetchErr] = useState<string | null>(null);
  const [bulkItems, setBulkItems] = useState<BulkPreviewItem[] | null>(null);
  const [bulkCompareIndex, setBulkCompareIndex] = useState<number | null>(null);

  // Aktarılan içeriği canlı TYMM sayfasıyla yan yana karşılaştırma modalı
  const [inspecting, setInspecting] = useState<InspectTarget | null>(null);

  // Hafta Ata sekmesi (ayrı, elle onaylanır): TYMM'den aktarılan ünitenin kazanımlarına DOCX'ten
  // hafta ata — sıra+sayı eşleşmesine dayanır, bkz. assignWeeksFromDocx.ts üstündeki not.
  const [weekUnitId, setWeekUnitId] = useState('');
  const [weekUniteName, setWeekUniteName] = useState('');
  const [weekPreviewing, setWeekPreviewing] = useState(false);
  const [weekPreview, setWeekPreview] = useState<MatchPreviewResponse | null>(null);
  const [weekPreviewErr, setWeekPreviewErr] = useState<string | null>(null);
  const [weekCommitting, setWeekCommitting] = useState(false);
  const [weekCommitResult, setWeekCommitResult] = useState<CommitWeeksResponse | null>(null);
  const [weekCommitErr, setWeekCommitErr] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: lessonsData }, { data: gradesData }] = await Promise.all([
        supabase.from('lessons').select('id, name').order('order_no'),
        supabase.from('grades').select('id, name').order('order_no'),
      ]);
      setLessons((lessonsData as LessonRow[] | null) || []);
      setGrades((gradesData as GradeRow[] | null) || []);
    })();
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setParseError('Sadece .docx dosyası kabul edilir.');
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setParseError(null);
    setRows(null);
    setStepLogs({ units: [], topics: [], outcomes: [] });
    setStepResult({ units: null, topics: null, outcomes: null });

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/yillik-plan/parse-docx', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.error || 'Ayrıştırma başarısız.');
        return;
      }
      setRows(withIds(data.rows));
      setUniteler(data.uniteler || []);
      setKonuCount(data.konu_count || 0);
      setRawJson(JSON.stringify(data.rows, null, 2));
    } catch {
      setParseError('Dosya işlenirken bir hata oluştu.');
    } finally {
      setParsing(false);
    }
  }, [withIds]);

  async function runStep(step: StepKey) {
    if (!rows || !lessonId || !gradeId) return;
    setStepRunning((s) => ({ ...s, [step]: true }));
    setStepLogs((s) => ({ ...s, [step]: [{ msg: 'Başlıyor…', level: 'info' }] }));
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch(STEP_ENDPOINTS[step], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: cleanRows, lessonId, gradeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStepLogs((s) => ({ ...s, [step]: [{ msg: data?.error || 'Hata oluştu.', level: 'error' }] }));
        return;
      }
      setStepLogs((s) => ({ ...s, [step]: data.logs || [] }));
      setStepResult((s) => ({ ...s, [step]: data.result || null }));
    } catch {
      setStepLogs((s) => ({ ...s, [step]: [{ msg: 'İstek başarısız.', level: 'error' }] }));
    } finally {
      setStepRunning((s) => ({ ...s, [step]: false }));
    }
  }

  async function runTymmFetch() {
    if (!tymmUrl.trim()) return;
    setFetching(true);
    setFetchErr(null);
    setPreviewUnit(null);
    setPreviewUnmatched([]);
    setPreviewRawSections(null);
    setSaveResult(null);
    setSaveErr(null);
    try {
      const res = await fetch('/api/admin/tymm/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tymmUrl: tymmUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchErr(data?.error || 'Çekme başarısız');
        return;
      }
      const result = data as TymmFetchResult;
      setPreviewUnit(result.unit);
      setPreviewUnmatched(result.unmatchedLines);
      setPreviewRawSections(result.rawSections);
    } catch {
      setFetchErr('İstek başarısız (ağ hatası)');
    } finally {
      setFetching(false);
    }
  }

  async function runTymmSave() {
    if (!previewUnit || !lessonId || !gradeId) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/admin/tymm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit: previewUnit, gradeId, lessonId, curriculumYear: tymmYear.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveErr(data?.error || 'Kaydetme başarısız');
        return;
      }
      const result = data as TymmImportResult;
      setSaveResult({ ...result, sourceUrl: tymmUrl.trim() });
      setPreviewUnit(null);
      setWeekUnitId(String(result.unitId));
    } catch {
      setSaveErr('İstek başarısız (ağ hatası)');
    } finally {
      setSaving(false);
    }
  }

  async function runTymmBulkFetch() {
    if (!bulkPageUrl.trim()) return;
    setBulkFetching(true);
    setBulkFetchErr(null);
    setBulkItems(null);
    try {
      const res = await fetch('/api/admin/tymm/fetch-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageUrl: bulkPageUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkFetchErr(data?.error || 'Bulma başarısız');
        return;
      }
      const result = data as BulkFetchResponse;
      setBulkItems(
        result.results.map((r) => ({
          url: r.url,
          title: r.title,
          unit: r.ok ? r.unit : null,
          unmatchedLines: r.ok ? r.unmatchedLines : [],
          rawSections: r.ok ? r.rawSections : null,
          fetchError: r.ok ? null : r.error,
          collapsed: true,
          saving: false,
          saveResult: null,
          saveErr: null,
        }))
      );
    } catch {
      setBulkFetchErr('İstek başarısız (ağ hatası)');
    } finally {
      setBulkFetching(false);
    }
  }

  function updateBulkItemUnit(index: number, mutator: (u: TymmUnit) => TymmUnit) {
    setBulkItems((items) => (items ? items.map((it, i) => (i === index && it.unit ? { ...it, unit: mutator(it.unit) } : it)) : items));
  }

  function toggleBulkItemCollapsed(index: number) {
    setBulkItems((items) => (items ? items.map((it, i) => (i === index ? { ...it, collapsed: !it.collapsed } : it)) : items));
  }

  async function saveBulkItem(index: number) {
    const item = bulkItems?.[index];
    if (!item || !item.unit || !lessonId || !gradeId) return;
    setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: true, saveErr: null } : it)));
    try {
      const res = await fetch('/api/admin/tymm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit: item.unit, gradeId, lessonId, curriculumYear: tymmYear.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveErr: data?.error || 'Kaydetme başarısız' } : it)));
        return;
      }
      const result = data as TymmImportResult;
      setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveResult: result, saveErr: null } : it)));
      setWeekUnitId(String(result.unitId));
    } catch {
      setBulkItems((items) => items!.map((it, i) => (i === index ? { ...it, saving: false, saveErr: 'İstek başarısız (ağ hatası)' } : it)));
    }
  }

  async function runWeekPreview() {
    const unitId = parseInt(weekUnitId, 10);
    if (!rows || !Number.isFinite(unitId) || !weekUniteName) return;
    setWeekPreviewing(true);
    setWeekPreviewErr(null);
    setWeekPreview(null);
    setWeekCommitResult(null);
    setWeekCommitErr(null);
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch('/api/admin/tymm/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, uniteName: weekUniteName, rows: cleanRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWeekPreviewErr(data?.error || 'Önizleme başarısız');
        return;
      }
      setWeekPreview(data as MatchPreviewResponse);
    } catch {
      setWeekPreviewErr('İstek başarısız (ağ hatası)');
    } finally {
      setWeekPreviewing(false);
    }
  }

  async function runWeekCommit() {
    const unitId = parseInt(weekUnitId, 10);
    if (!rows || !Number.isFinite(unitId) || !weekUniteName) return;
    setWeekCommitting(true);
    setWeekCommitErr(null);
    setWeekCommitResult(null);
    try {
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      const res = await fetch('/api/admin/tymm/commit-weeks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId, uniteName: weekUniteName, rows: cleanRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWeekCommitErr(data?.error || 'Kaydetme başarısız');
        return;
      }
      setWeekCommitResult(data as CommitWeeksResponse);
    } catch {
      setWeekCommitErr('İstek başarısız (ağ hatası)');
    } finally {
      setWeekCommitting(false);
    }
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) throw new Error('Kök eleman bir dizi olmalı.');
      setRows(withIds(parsed));
      setRawJsonError(null);
    } catch (e) {
      setRawJsonError(e instanceof Error ? e.message : 'Geçersiz JSON');
    }
  }

  function updateRow(id: number, field: keyof ParsedRow, value: string) {
    if (!rows) return;
    const next = rows.map((r) => {
      if (r._id !== id) return r;
      if (field === 'week_no' || field === 'saat') {
        return { ...r, [field]: value.trim() ? parseInt(value, 10) : null };
      }
      return { ...r, [field]: value };
    });
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  function updateKazanim(id: number, value: string) {
    if (!rows) return;
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error();
      const next = rows.map((r) => (r._id === id ? { ...r, kazanım: parsed } : r));
      setRows(next);
      setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
    } catch {
      // geçersiz JSON — sessizce yoksay, kullanıcı düzeltene kadar bekle
    }
  }

  function deleteRow(id: number) {
    if (!rows) return;
    const next = rows.filter((r) => r._id !== id);
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  function addRow() {
    const next = [...(rows || []), { week_no: null, Hafta: '', ünite: '', konu: '', kazanım: [], saat: null, _id: nextRowId.current++ }];
    setRows(next);
    setRawJson(JSON.stringify(next.map(({ _id, ...rest }) => rest), null, 2));
  }

  const ready = !!rows && rows.length > 0 && lessonId != null && gradeId != null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <StepFlow rows={rows} results={stepResult} />

      {/* DOSYA YÜKLE — her iki sekmede de (klasik aktarım + hafta atama) kullanıldığı için sekmelerin dışında, hep görünür */}
      <Card title="DOCX Yükle">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-zinc-300 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/20'
          }`}
        >
          <input
            type="file"
            accept=".docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">DOCX sürükle veya tıkla</p>
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-1">Yıllık plan tablosu içeren .docx dosyası</p>
          {fileName && <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-3">{parsing ? '⏳ ' : '✅ '}{fileName}</p>}
        </div>
        {parseError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {parseError}</p>}

        {rows && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Ünite" value={uniteler.length} />
              <Stat label="Konu" value={konuCount} />
              <Stat label="Satır" value={rows.length} />
            </div>
            {uniteler.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {uniteler.map((u) => (
                  <span key={u} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                    {u}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setEditorOpen((v) => !v)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors"
            >
              {editorOpen ? '▲ Düzenleyiciyi Kapat' : '✏️ Kaydetmeden önce düzenle'}
            </button>
          </div>
        )}
      </Card>

      {editorOpen && rows && (
        <Card title="Veri Düzenleyici">
          <RowTable rows={rows} onUpdate={updateRow} onUpdateKazanim={updateKazanim} onDelete={deleteRow} onAdd={addRow} />
          <details className="mt-4">
            <summary className="text-xs font-bold text-zinc-500 dark:text-gray-400 cursor-pointer">Ham JSON olarak düzenle</summary>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full mt-2 rounded-lg border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/40 p-3 text-xs font-mono text-emerald-600 dark:text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={applyRawJson} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors">
                JSON&apos;u Uygula
              </button>
              {rawJsonError && <span className="text-xs text-red-600 dark:text-red-400">❌ {rawJsonError}</span>}
            </div>
          </details>
        </Card>
      )}

      {/* DERS / SINIF SEÇ — sekmelerin dışında, klasik aktarım da TYMM aktarımı da bunu kullanır */}
      <Card title="Ders ve Sınıf Seç">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PickList label="Ders" items={lessons} selectedId={lessonId} onSelect={setLessonId} />
          <PickList label="Sınıf" items={grades} selectedId={gradeId} onSelect={setGradeId} />
        </div>
      </Card>

      {/* SEKMELER — üç ayrı iş akışı karışmasın diye ayrıldı */}
      <TabBar
        tabs={[
          { key: 'docx', label: '📄 Klasik Aktarım' },
          { key: 'tymm', label: '🌐 TYMM’den Aktar' },
          { key: 'weeks', label: '📅 Hafta Ata' },
        ]}
        active={activeTab}
        onSelect={(k) => setActiveTab(k as typeof activeTab)}
      />

      {activeTab === 'docx' && (
      <Card title="Üniteler · Konular · Kazanımlar">
        <div className="space-y-4">
          <StepRunner
            step="units"
            title="Üniteler"
            description="Benzersiz üniteler units tablosuna eklenir; lesson_grades bağlantısı oluşturulur."
            ready={ready}
            running={stepRunning.units}
            logs={stepLogs.units}
            result={stepResult.units}
            onRun={() => runStep('units')}
          />
          <StepRunner
            step="topics"
            title="Konular"
            description="Benzersiz (ünite, konu) çiftleri topics tablosuna eklenir."
            ready={ready}
            running={stepRunning.topics}
            logs={stepLogs.topics}
            result={stepResult.topics}
            onRun={() => runStep('topics')}
          />
          <StepRunner
            step="outcomes"
            title="Kazanımlar"
            description="Kazanımlar outcomes tablosuna (baştaki a), b) numaralandırması silinip) eklenir, geçtiği haftalar outcome_weeks'e (start/end) yazılır, kod (a, b, c...) otomatik atanır."
            ready={ready}
            running={stepRunning.outcomes}
            logs={stepLogs.outcomes}
            result={stepResult.outcomes}
            onRun={() => runStep('outcomes')}
          />
        </div>
      </Card>
      )}

      {activeTab === 'tymm' && (
      <Card title="TYMM'den İçerik Aktar">
        <p className="text-xs text-zinc-500 dark:text-gray-500 mb-4">
          Yeni müfredat (tymm.meb.gov.tr) sayfasındaki ünite/konu/kazanım/anahtar kavram metnini önce ÇEKER ve
          önizler — hiçbir şey otomatik kaydedilmez. Gerekirse metni düzeltip ünite ünite elle onaylayınca DB&apos;ye
          yazılır. Hafta ataması &quot;Hafta Ata&quot; sekmesinde ayrı bir adımda yapılır.
        </p>

        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => setTymmBulkMode(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              !tymmBulkMode ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-400 hover:border-zinc-400 dark:hover:border-white/20'
            }`}
          >
            Tek Ünite
          </button>
          <button
            onClick={() => setTymmBulkMode(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              tymmBulkMode ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-400 hover:border-zinc-400 dark:hover:border-white/20'
            }`}
          >
            Toplu (Ders/Sınıf Sayfası)
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1.5">Müfredat Yılı (ör. 2025-2026)</label>
          <input
            value={tymmYear}
            onChange={(e) => setTymmYear(e.target.value)}
            placeholder="2025-2026"
            className="w-full sm:w-64 bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
          />
          <p className="text-[11px] text-zinc-500 dark:text-gray-500 mt-1">Kaydetmeden hemen önce kontrol et — sonradan değiştirirsen aynı içerik yeniden (mükerrer) kaydedilir.</p>
        </div>

        {(!lessonId || !gradeId) && (
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            ⚠️ Kaydetmeden önce yukarıda Ders ve Sınıf seçin.
          </p>
        )}

        <div className="h-px bg-zinc-200 dark:bg-white/5 mb-4" />

        {!tymmBulkMode ? (
          <>
            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1.5">TYMM Ünite URL&apos;i</label>
              <input
                value={tymmUrl}
                onChange={(e) => setTymmUrl(e.target.value)}
                placeholder="https://tymm.meb.gov.tr/.../unite/408"
                className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
              />
            </div>

            <button
              onClick={runTymmFetch}
              disabled={fetching || !tymmUrl.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {fetching ? 'Çekiliyor…' : '👁 Getir ve Önizle'}
            </button>

            {fetchErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {fetchErr}</p>}

            {previewUnit && (
              <div className="mt-4 rounded-xl border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-bold text-zinc-500 dark:text-gray-400">Önizleme — gerekirse düzelt, sonra onayla.</p>
                  <button
                    onClick={() => setComparePreviewOpen(true)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold hover:bg-indigo-500/20"
                  >
                    🔍 TYMM ile Karşılaştır
                  </button>
                </div>
                <TymmUnitEditor
                  unit={previewUnit}
                  unmatchedLines={previewUnmatched}
                  onChange={(mutator) => setPreviewUnit((u) => (u ? mutator(u) : u))}
                />
                {saveErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {saveErr}</p>}
                <button
                  onClick={runTymmSave}
                  disabled={saving || !lessonId || !gradeId}
                  className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {saving ? 'Kaydediliyor…' : '✅ Onayla ve Kaydet'}
                </button>
              </div>
            )}

            {saveResult && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">✅ &quot;{saveResult.unitTitle}&quot; kaydedildi (ünite #{saveResult.unitId})</p>
                  <button
                    onClick={() => setInspecting({ unitId: saveResult.unitId, tymmUrl: saveResult.sourceUrl, unitTitle: saveResult.unitTitle })}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold hover:bg-indigo-500/20"
                  >
                    🔍 İncele
                  </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-gray-400">
                  {saveResult.topicsCreated} yeni konu · {saveResult.outcomesCreated} yeni kazanım
                  {saveResult.outcomesSkipped > 0 && ` · ${saveResult.outcomesSkipped} zaten vardı`}
                </p>
                <p className="text-[11px] text-indigo-600 dark:text-indigo-300 mt-2">Ünite #{saveResult.unitId}, &quot;Hafta Ata&quot; sekmesine otomatik dolduruldu.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1.5">TYMM Ders/Sınıf Sayfası URL&apos;i</label>
              <input
                value={bulkPageUrl}
                onChange={(e) => setBulkPageUrl(e.target.value)}
                placeholder="https://tymm.meb.gov.tr/ogretim-programlari/din-kulturu-ve-ahlak-bilgisi-dersi/6"
                className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-zinc-500 dark:text-gray-500 mt-1">Bu sayfadaki tüm üniteler bulunup çekilir — hiçbiri otomatik kaydedilmez, ünite ünite onaylarsın.</p>
            </div>

            <button
              onClick={runTymmBulkFetch}
              disabled={bulkFetching || !bulkPageUrl.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {bulkFetching ? 'Bulunuyor…' : '👁 Üniteleri Bul ve Önizle'}
            </button>

            {bulkFetchErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {bulkFetchErr}</p>}

            {bulkItems && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${(bulkItems.filter((it) => it.saveResult).length / bulkItems.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-zinc-500 dark:text-gray-400 flex-shrink-0">
                    {bulkItems.filter((it) => it.saveResult).length}/{bulkItems.length} kaydedildi
                  </p>
                </div>
                {bulkItems.map((item, idx) => {
                  const topicCount = item.unit?.learningOutcomes.length ?? 0;
                  const outcomeCount = item.unit?.learningOutcomes.reduce((n, o) => n + o.components.length, 0) ?? 0;
                  return (
                  <div
                    key={item.url}
                    className={`rounded-xl border p-4 transition-colors ${item.saveResult ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/20'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            item.saveResult ? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-500'
                          }`}
                        >
                          {item.saveResult ? '✓' : idx + 1}
                        </span>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{item.title}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {item.saveResult && (
                          <button
                            onClick={() => setInspecting({ unitId: item.saveResult!.unitId, tymmUrl: item.url, unitTitle: item.title })}
                            className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
                          >
                            🔍 İncele
                          </button>
                        )}
                        {item.unit && !item.saveResult && (
                          <>
                            <button
                              onClick={() => setBulkCompareIndex(idx)}
                              className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-bold hover:bg-indigo-500/20 transition-colors"
                            >
                              🔍 Karşılaştır
                            </button>
                            <button
                              onClick={() => toggleBulkItemCollapsed(idx)}
                              className="text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors flex items-center gap-0.5"
                            >
                              {item.collapsed ? '▸ Göster' : '▾ Gizle'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {item.unit && (
                      <p className="text-[11px] text-zinc-500 dark:text-gray-500 mt-1 ml-[34px]">
                        {topicCount} konu · {outcomeCount} kazanım
                      </p>
                    )}

                    {item.fetchError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">❌ {item.fetchError}</p>}

                    {item.saveResult ? (
                      <p className="text-xs text-zinc-500 dark:text-gray-400 mt-1.5 ml-[34px]">
                        ✅ Kaydedildi (ünite #{item.saveResult.unitId}) · {item.saveResult.topicsCreated} yeni konu ·{' '}
                        {item.saveResult.outcomesCreated} yeni kazanım
                        {item.saveResult.outcomesSkipped > 0 && ` · ${item.saveResult.outcomesSkipped} zaten vardı`}
                      </p>
                    ) : (
                      item.unit &&
                      !item.collapsed && (
                        <div className="mt-3">
                          <TymmUnitEditor
                            unit={item.unit}
                            unmatchedLines={item.unmatchedLines}
                            onChange={(mutator) => updateBulkItemUnit(idx, mutator)}
                          />
                          {item.saveErr && <p className="text-xs text-red-600 dark:text-red-400 mt-2">❌ {item.saveErr}</p>}
                          <button
                            onClick={() => saveBulkItem(idx)}
                            disabled={item.saving || !lessonId || !gradeId}
                            className="mt-3 px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {item.saving ? 'Kaydediliyor…' : '✅ Bu Üniteyi Onayla ve Kaydet'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>
      )}

      {activeTab === 'weeks' && (
      <Card title="DOCX'ten Hafta Ata">
        <p className="text-xs text-zinc-500 dark:text-gray-500 mb-4">
          Yukarıda TYMM&apos;den aktarılmış bir ünitenin konu/kazanımlarına, DOCX&apos;ten çıkan hafta sırasını atar. Metin benzerliğine değil, konu/kazanım SAYISININ birebir
          eşleşmesine dayanır — sayılar uyuşmazsa hiçbir şey kaydedilmez.
        </p>

        {!rows || rows.length === 0 ? (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
            ⚠️ Önce yukarıda bir DOCX yükleyin — bu araç, kazanımları DOCX&apos;ten çıkan hafta sırasıyla
            eşleştirdiği için DOCX verisine ihtiyaç duyuyor.
          </p>
        ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1.5">Ünite ID</label>
              <input
                value={weekUnitId}
                onChange={(e) => setWeekUnitId(e.target.value)}
                placeholder="TYMM’den Aktar sekmesinden otomatik dolar"
                className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1.5">Bu ünite DOCX&apos;teki hangi üniteye denk geliyor?</label>
            <div className="flex flex-wrap gap-1.5">
              {uniteler.map((u) => (
                <button
                  key={u}
                  onClick={() => setWeekUniteName(u)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    weekUniteName === u ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-400 hover:border-zinc-400 dark:hover:border-white/20'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runWeekPreview}
            disabled={weekPreviewing || !weekUnitId.trim() || !weekUniteName}
            className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {weekPreviewing ? 'Kontrol ediliyor…' : '🔍 Eşleşmeyi Önizle'}
          </button>

          {weekPreviewErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {weekPreviewErr}</p>}

          {weekPreview && (
            <div className="mt-4">
              {weekPreview.result.ok && weekPreview.preview ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                    ✅ Sayılar uyuştu — {weekPreview.preview.length} konu, hazır
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {weekPreview.preview.map((t) => (
                      <div key={t.topicId} className="rounded-lg border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/20 p-2.5">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white">{t.topicTitle}</p>
                        <ul className="mt-1 space-y-0.5">
                          {t.outcomes.map((o) => (
                            <li key={o.id} className="text-[11px] text-zinc-500 dark:text-gray-400">
                              {o.code && <span className="text-indigo-600 dark:text-indigo-300 font-mono">{o.code}) </span>}{o.description}
                              <span className="text-zinc-400 dark:text-gray-600"> — hafta {o.startWeek === o.endWeek ? o.startWeek : `${o.startWeek}-${o.endWeek}`}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={runWeekCommit}
                    disabled={weekCommitting}
                    className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {weekCommitting ? 'Kaydediliyor…' : '💾 Haftaları Kaydet'}
                  </button>
                </div>
              ) : !weekPreview.result.ok ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-2">
                    ❌ Sayılar uyuşmuyor — hiçbir şey kaydedilmedi
                  </p>
                  {weekPreview.result.reason === 'topic-count-mismatch' && (
                    <div className="text-xs text-zinc-500 dark:text-gray-400 space-y-2">
                      <p>DB&apos;de {weekPreview.result.tymmCount} konu, DOCX&apos;te {weekPreview.result.docxCount} konu var.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="font-bold text-zinc-500 dark:text-gray-500 mb-1">DB</p>{weekPreview.result.dbTopicTitles.map((t, i) => <p key={i}>{t}</p>)}</div>
                        <div><p className="font-bold text-zinc-500 dark:text-gray-500 mb-1">DOCX</p>{weekPreview.result.docxTitles.map((t, i) => <p key={i}>{t}</p>)}</div>
                      </div>
                    </div>
                  )}
                  {weekPreview.result.reason === 'outcome-count-mismatch' && (
                    <p className="text-xs text-zinc-500 dark:text-gray-400">
                      &quot;{weekPreview.result.dbTopicTitle}&quot; ({weekPreview.result.dbCount} kazanım) ile DOCX&apos;teki
                      &quot;{weekPreview.result.docxTopicTitle}&quot; ({weekPreview.result.docxCount} kazanım) sayıca uyuşmuyor.
                      Muhtemelen DOCX&apos;te bu konuya sınav haftası gibi kazanım-olmayan bir satır karışmış olabilir —
                      yukarıdaki düzenleyiciden kontrol edin.
                    </p>
                  )}
                  {weekPreview.result.reason === 'no-docx-rows' && (
                    <p className="text-xs text-zinc-500 dark:text-gray-400">DOCX&apos;te &quot;{weekPreview.result.uniteName}&quot; adında bir ünite bulunamadı.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {weekCommitErr && <p className="text-sm text-red-600 dark:text-red-400 mt-3">❌ {weekCommitErr}</p>}
          {weekCommitResult && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">✅ {weekCommitResult.weeksWritten} hafta kaydı yazıldı</p>
          )}
        </>
        )}
      </Card>
      )}

      {inspecting && <TymmInspectModal key={inspecting.unitId} target={inspecting} onClose={() => setInspecting(null)} />}

      {comparePreviewOpen && previewUnit && (
        <TymmPreviewCompareModal
          tymmUrl={tymmUrl.trim()}
          unit={previewUnit}
          unmatchedLines={previewUnmatched}
          rawSections={previewRawSections}
          onChange={(mutator) => setPreviewUnit((u) => (u ? mutator(u) : u))}
          onClose={() => setComparePreviewOpen(false)}
        />
      )}

      {bulkCompareIndex != null && bulkItems?.[bulkCompareIndex]?.unit && (
        <TymmPreviewCompareModal
          tymmUrl={bulkItems[bulkCompareIndex].url}
          unit={bulkItems[bulkCompareIndex].unit as TymmUnit}
          unmatchedLines={bulkItems[bulkCompareIndex].unmatchedLines}
          rawSections={bulkItems[bulkCompareIndex].rawSections}
          onChange={(mutator) => updateBulkItemUnit(bulkCompareIndex, mutator)}
          onClose={() => setBulkCompareIndex(null)}
        />
      )}
    </div>
  );
}

// ==================== ALT BİLEŞENLER ====================

// TYMM'den çekilmiş bir ünitenin (henüz DB'ye yazılmamış) önizlemesini elle düzeltmeye
// yarar — ufak metin hataları, yanlış ayrıştırılmış bir satır vb. için. `onChange` bir
// mutator alır (mevcut unit'i alıp yenisini döner) ki hem tekli hem toplu moddaki
// bağımsız state'lere aynı bileşen üzerinden yazılabilsin.
function TymmUnitEditor({
  unit,
  unmatchedLines,
  onChange,
}: {
  unit: TymmUnit;
  unmatchedLines: string[];
  onChange: (mutator: (u: TymmUnit) => TymmUnit) => void;
}) {
  // Varsayılan görünüm SALT OKUNUR ve derli toplu — bir konuyu düzeltmek gerekirse sadece
  // o konunun kalem ikonuna tıklanır, tüm ünite tek seferde düzenlenebilir hâle gelmiyor.
  const [editingTopic, setEditingTopic] = useState<number | null>(null);
  const [editingKeyConcepts, setEditingKeyConcepts] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1">Ünite Başlığı</label>
          <input
            value={unit.unitTitle}
            onChange={(e) => { const v = e.target.value; onChange((u) => ({ ...u, unitTitle: v })); }}
            className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1">Ders Saati</label>
          <input
            type="number"
            value={unit.durationHours ?? ''}
            onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; onChange((u) => ({ ...u, durationHours: v })); }}
            className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500">Anahtar Kavramlar</label>
          <button onClick={() => setEditingKeyConcepts((v) => !v)} className="text-zinc-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-xs" title="Düzenle">
            {editingKeyConcepts ? '✓ Bitti' : '✏️'}
          </button>
        </div>
        {editingKeyConcepts ? (
          <input
            value={unit.keyConcepts.join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              onChange((u) => ({ ...u, keyConcepts: list }));
            }}
            placeholder="virgülle ayır"
            className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
          />
        ) : unit.keyConcepts.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {unit.keyConcepts.map((k, i) => (
              <span key={i} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-gray-300 border border-zinc-300 dark:border-white/10">{k}</span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-400 dark:text-gray-600 italic">yok</p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500">Konular ({unit.learningOutcomes.length})</label>
          <span className="text-[10px] text-zinc-400 dark:text-gray-600">
            toplam {unit.learningOutcomes.reduce((n, o) => n + o.components.length, 0)} kazanım
          </span>
        </div>
        <ol className="space-y-0.5 rounded-lg border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-2">
          {unit.learningOutcomes.map((outcome, oi) => (
            <li key={oi}>
              <button
                onClick={() => setEditingTopic(oi)}
                className={`w-full text-left text-xs px-1.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                  editingTopic === oi ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'text-zinc-700 dark:text-gray-300 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-indigo-300'
                }`}
              >
                <span className="text-zinc-400 dark:text-gray-600 font-mono flex-shrink-0">{oi + 1}.</span>
                <span className="flex-1 truncate">{outcome.topicTitle || <span className="italic text-zinc-400 dark:text-gray-600">(başlıksız)</span>}</span>
                <span
                  className={`flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    outcome.components.length === 0 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-zinc-500 dark:text-gray-500 bg-zinc-100 dark:bg-white/5'
                  }`}
                >
                  {outcome.components.length}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2">
        {unit.learningOutcomes.map((outcome, oi) =>
          editingTopic === oi ? (
            <div key={oi} className="rounded-lg border border-indigo-400/40 bg-indigo-500/[0.04] p-3">
              <div className="flex items-start gap-2 mb-1.5">
                <div className="flex-1 space-y-1.5">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-0.5">Konu Başlığı (İçerik Çerçevesi)</label>
                    <input
                      value={outcome.topicTitle}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.map((o, i) => (i === oi ? { ...o, topicTitle: v } : o)) }));
                      }}
                      className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-0.5">
                      Öğrenme Çıktısı {outcome.code && <span className="font-mono normal-case text-zinc-400 dark:text-gray-600">({outcome.code})</span>}
                    </label>
                    <textarea
                      value={outcome.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.map((o, i) => (i === oi ? { ...o, title: v } : o)) }));
                      }}
                      rows={2}
                      className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-zinc-700 dark:text-gray-300 outline-none focus:border-indigo-400 resize-y"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    onChange((u) => ({ ...u, learningOutcomes: u.learningOutcomes.filter((_, i) => i !== oi) }));
                    setEditingTopic(null);
                  }}
                  className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors text-sm mt-4"
                  title="Bu konuyu sil"
                >
                  🗑
                </button>
              </div>
              <div className="space-y-1.5 pl-4 mt-2">
                {outcome.components.map((comp, ci) => (
                  <div key={ci} className="flex items-start gap-1.5">
                    <input
                      value={comp.letter}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.map((c, j) => (j === ci ? { ...c, letter: v } : c)) } : o
                          ),
                        }));
                      }}
                      className="w-8 flex-shrink-0 bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-1.5 py-1 text-[11px] text-indigo-600 dark:text-indigo-300 font-mono outline-none focus:border-indigo-400 text-center"
                    />
                    <textarea
                      value={comp.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.map((c, j) => (j === ci ? { ...c, text: v } : c)) } : o
                          ),
                        }));
                      }}
                      rows={1}
                      className="flex-1 bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-2 py-1 text-[11px] text-zinc-700 dark:text-gray-300 outline-none focus:border-indigo-400 resize-y"
                    />
                    <button
                      onClick={() =>
                        onChange((u) => ({
                          ...u,
                          learningOutcomes: u.learningOutcomes.map((o, i) =>
                            i === oi ? { ...o, components: o.components.filter((_, j) => j !== ci) } : o
                          ),
                        }))
                      }
                      className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors text-xs mt-1"
                      title="Bu kazanımı sil"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    onClick={() =>
                      onChange((u) => ({
                        ...u,
                        learningOutcomes: u.learningOutcomes.map((o, i) =>
                          i === oi ? { ...o, components: [...o.components, { letter: '', text: '' }] } : o
                        ),
                      }))
                    }
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200 transition-colors"
                  >
                    ➕ Kazanım Ekle
                  </button>
                  <button onClick={() => setEditingTopic(null)} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors ml-auto">
                    ✓ Bitti
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div key={oi} className="group rounded-lg border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/20 hover:border-zinc-400 dark:hover:border-white/20 transition-colors p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white">{outcome.topicTitle || <span className="italic text-zinc-400 dark:text-gray-600">(başlıksız)</span>}</p>
                  <p className="text-[10px] text-zinc-500 dark:text-gray-500 mt-0.5">
                    {outcome.code && <span className="font-mono text-zinc-400 dark:text-gray-600">{outcome.code}. </span>}
                    {outcome.title}
                  </p>
                </div>
                <button
                  onClick={() => setEditingTopic(oi)}
                  className="flex-shrink-0 text-zinc-500 dark:text-gray-500 group-hover:text-zinc-700 dark:group-hover:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-sm"
                  title="Bu konuyu düzenle"
                >
                  ✏️
                </button>
              </div>
              <ul className="mt-2 space-y-1 pl-1 border-l border-zinc-200 dark:border-white/5">
                {outcome.components.map((comp, ci) => (
                  <li key={ci} className="text-[11px] text-zinc-700 dark:text-gray-300 leading-relaxed pl-2">
                    <span className="text-indigo-600 dark:text-indigo-300 font-mono">{comp.letter}) </span>
                    {comp.text || <span className="italic text-zinc-400 dark:text-gray-600">(boş)</span>}
                  </li>
                ))}
                {outcome.components.length === 0 && <li className="text-[11px] text-amber-600 dark:text-amber-400/80 italic pl-2">⚠️ kazanım yok</li>}
              </ul>
            </div>
          )
        )}
      </div>

      {unmatchedLines.length > 0 && (
        <details>
          <summary className="text-[11px] font-bold text-amber-600 dark:text-amber-400 cursor-pointer">⚠️ {unmatchedLines.length} satır ayrıştırılamadı</summary>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-gray-500 space-y-0.5 max-h-32 overflow-y-auto">
            {unmatchedLines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </details>
      )}
    </div>
  );
}

// Solda içerik (DB'deki kayıt ya da henüz kaydedilmemiş önizleme), sağda gerçek TYMM
// sayfası — admin kafasından karşılaştırmak yerine ikisini yan yana görüp öyle
// onaylayabilsin diye (bkz. proje sohbeti: "kafamdan kontrol edemem").
function SplitCompareView({
  title,
  tymmUrl,
  onClose,
  left,
  right,
}: {
  title: string;
  tymmUrl: string;
  onClose: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#111114] rounded-2xl border border-zinc-300 dark:border-white/10 w-full h-full max-w-[1400px] flex flex-col sm:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full sm:w-1/2 h-1/2 sm:h-full overflow-y-auto p-5 border-b sm:border-b-0 sm:border-r border-zinc-300 dark:border-white/10">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">{title}</h3>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 dark:text-gray-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
          {left}
        </div>

        <div className="w-full sm:w-1/2 h-1/2 sm:h-full overflow-y-auto p-5">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-sm font-bold text-zinc-500 dark:text-gray-400">TYMM&apos;den çekilen bölümler</h3>
            <a href={tymmUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 text-[11px] text-indigo-600 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-200">
              Tam sayfayı aç ↗
            </a>
          </div>
          {right}
        </div>
      </div>
    </div>
  );
}

// Canlı TYMM sayfasının TAMAMI yerine sadece bizim çektiğimiz üç alanı düz metin olarak
// gösterir — admin sayfada gezinip ilgili yeri aramak zorunda kalmasın diye (bkz. proje
// sohbeti: "ekran görüntüsü gibi ama sadece çektiğimiz bölümler"). Stil önemli değil,
// okunabilir olması yeterli.
function TymmRawSectionsView({ rawSections }: { rawSections: TymmRawSections | null }) {
  if (!rawSections) return <p className="text-xs text-zinc-500 dark:text-gray-500">Yükleniyor…</p>;
  const sections: { label: string; value: string }[] = [
    { label: 'İçerik Çerçevesi', value: rawSections.contentFramework },
    { label: 'Anahtar Kavramlar', value: rawSections.keyConcepts },
    { label: 'Öğrenme Çıktıları ve Süreç Bileşenleri', value: rawSections.learningOutcomes },
  ];
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.label}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-1">{s.label}</p>
          <div className="rounded-lg border border-zinc-300 dark:border-white/10 bg-zinc-50 dark:bg-black/20 p-3 text-[11px] text-zinc-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {s.value || <span className="italic text-zinc-400 dark:text-gray-600">bulunamadı</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// KAYDETMEDEN ÖNCE karşılaştırma: sol tarafta düzenlenebilir önizleme (TymmUnitEditor),
// sağda TYMM'den çektiğimiz ham bölümler — admin düzeltmeleri doğrudan burada, kaynağa
// bakarak yapabilir.
function TymmPreviewCompareModal({
  tymmUrl,
  unit,
  unmatchedLines,
  rawSections,
  onChange,
  onClose,
}: {
  tymmUrl: string;
  unit: TymmUnit;
  unmatchedLines: string[];
  rawSections: TymmRawSections | null;
  onChange: (mutator: (u: TymmUnit) => TymmUnit) => void;
  onClose: () => void;
}) {
  return (
    <SplitCompareView
      title={`${unit.unitTitle} — Önizleme (düzenlenebilir)`}
      tymmUrl={tymmUrl}
      onClose={onClose}
      left={<TymmUnitEditor unit={unit} unmatchedLines={unmatchedLines} onChange={onChange} />}
      right={<TymmRawSectionsView rawSections={rawSections} />}
    />
  );
}

// KAYDEDİLDİKTEN SONRA kontrol: sol tarafta DB'deki güncel hâli (salt okunur), sağda
// TYMM'den çektiğimiz ham bölümler (canlı sayfadan taze çekilir).
function TymmInspectModal({ target, onClose }: { target: InspectTarget; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UnitContentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rawSections, setRawSections] = useState<TymmRawSections | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/admin/tymm/unit-content?unitId=${target.unitId}`).then(async (res) => ({ ok: res.ok, data: await res.json() })),
      fetch('/api/admin/tymm/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tymmUrl: target.tymmUrl }),
      }).then(async (res) => ({ ok: res.ok, data: await res.json() })),
    ])
      .then(([content, fetched]) => {
        if (cancelled) return;
        if (!content.ok) { setErr(content.data?.error || 'Yüklenemedi'); return; }
        setData(content.data as UnitContentResponse);
        if (fetched.ok) setRawSections(fetched.data.rawSections as TymmRawSections);
      })
      .catch(() => { if (!cancelled) setErr('İstek başarısız (ağ hatası)'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target.unitId, target.tymmUrl]);

  return (
    <SplitCompareView
      title={`${target.unitTitle} — DB'deki İçerik`}
      tymmUrl={target.tymmUrl}
      onClose={onClose}
      right={<TymmRawSectionsView rawSections={rawSections} />}
      left={
        <>
          {loading && <p className="text-xs text-zinc-500 dark:text-gray-500">Yükleniyor…</p>}
          {err && <p className="text-xs text-red-600 dark:text-red-400">❌ {err}</p>}
          {data && (
            <div className="space-y-3">
              {data.unit.key_concepts && data.unit.key_concepts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.unit.key_concepts.map((k) => (
                    <span key={k} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-gray-300 border border-zinc-300 dark:border-white/10">{k}</span>
                  ))}
                </div>
              )}
              {data.topics.map((t, ti) => (
                <div key={t.id} className="rounded-lg border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/20 p-3">
                  <p className="text-xs font-bold text-zinc-900 dark:text-white">
                    <span className="text-zinc-400 dark:text-gray-600 font-mono">{ti + 1}.</span> {t.title}
                  </p>
                  {t.learningOutcome && <p className="text-[10px] text-zinc-500 dark:text-gray-500 mt-0.5 mb-1.5">{t.learningOutcome}</p>}
                  <ul className="space-y-1 mt-1.5 border-l border-zinc-200 dark:border-white/5">
                    {t.outcomes.map((o) => (
                      <li key={o.id} className="text-[11px] text-zinc-500 dark:text-gray-400 pl-2">
                        {o.code && <span className="text-indigo-600 dark:text-indigo-300 font-mono">{o.code}) </span>}{o.description}
                      </li>
                    ))}
                    {t.outcomes.length === 0 && <li className="text-[11px] text-amber-600 dark:text-amber-400/80 italic pl-2">⚠️ kazanım yok</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      }
    />
  );
}

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-black/20 border border-zinc-200 dark:border-white/5 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
            active === t.key
              ? 'bg-white dark:bg-[#111114] text-indigo-600 dark:text-indigo-300 shadow-sm'
              : 'text-zinc-500 dark:text-gray-400 hover:text-zinc-800 dark:hover:text-gray-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111114] rounded-2xl border border-zinc-200 dark:border-white/5 p-5 sm:p-6">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-100 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/5 p-3 text-center">
      <div className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function StepFlow({ rows, results }: { rows: EditableRow[] | null; results: Record<StepKey, StepResult | null> }) {
  const steps: { key: string; label: string; done: boolean }[] = [
    { key: 'docx', label: 'DOCX→JSON', done: !!rows },
    { key: 'units', label: 'Üniteler', done: !!results.units },
    { key: 'topics', label: 'Konular', done: !!results.topics },
    { key: 'outcomes', label: 'Kazanımlar', done: !!results.outcomes },
  ];
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                s.done ? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-500'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-bold ${s.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-gray-500'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 max-w-10 ${s.done ? 'bg-emerald-400' : 'bg-zinc-200 dark:bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PickList<T extends { id: number; name: string }>({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-gray-500 mb-2">{label}</p>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-zinc-500 dark:text-gray-500 py-2 text-center">Yükleniyor…</p>}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors ${
              selectedId === item.id
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-zinc-300 dark:border-white/10 text-zinc-500 dark:text-gray-400 hover:border-zinc-400 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedId === item.id ? 'bg-indigo-400' : 'bg-zinc-300 dark:bg-white/20'}`} />
            <span className="flex-1 truncate">{item.name}</span>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-gray-500">#{item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepRunner({
  title,
  description,
  ready,
  running,
  logs,
  result,
  onRun,
}: {
  step: StepKey;
  title: string;
  description: string;
  ready: boolean;
  running: boolean;
  logs: LogEntry[];
  result: StepResult | null;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-zinc-900 dark:text-white">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onRun}
          disabled={!ready || running}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          {running ? 'Çalışıyor…' : `▶ ${title} Yükle`}
        </button>
      </div>

      {result && (
        <div className="flex gap-4 mt-3 text-xs font-mono">
          <span className="text-emerald-600 dark:text-emerald-400">✅ {result.basarili}</span>
          <span className="text-zinc-500 dark:text-gray-500">⊘ {result.atlanmis}</span>
          <span className="text-red-600 dark:text-red-400">❌ {result.hata}</span>
          {result.hafta_atlanmis != null && <span className="text-zinc-500 dark:text-gray-500">📅 ⊘{result.hafta_atlanmis}</span>}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-3 bg-zinc-100 dark:bg-black/40 rounded-lg border border-zinc-200 dark:border-white/5 p-3 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                l.level === 'error' ? 'text-red-600 dark:text-red-400' :
                l.level === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500 dark:text-gray-400'
              }
            >
              {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RowTable({
  rows,
  onUpdate,
  onUpdateKazanim,
  onDelete,
  onAdd,
}: {
  rows: EditableRow[];
  onUpdate: (id: number, field: keyof ParsedRow, value: string) => void;
  onUpdateKazanim: (id: number, value: string) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="max-h-[600px] overflow-auto rounded-lg border border-zinc-200 dark:border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-100 dark:bg-[#1a1a20]">
            <tr>
              <th className="text-left font-bold text-zinc-500 dark:text-gray-400 p-2 w-16">Hafta</th>
              <th className="text-left font-bold text-zinc-500 dark:text-gray-400 p-2 min-w-[140px]">Ünite</th>
              <th className="text-left font-bold text-zinc-500 dark:text-gray-400 p-2 min-w-[140px]">Konu</th>
              <th className="text-left font-bold text-zinc-500 dark:text-gray-400 p-2 min-w-[480px]">Kazanımlar (JSON)</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-zinc-200 dark:border-white/5">
                <td className="p-1.5">
                  <input
                    type="number"
                    value={r.week_no ?? ''}
                    onChange={(e) => onUpdate(r._id, 'week_no', e.target.value)}
                    className="w-14 bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-1.5 py-1 text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.ünite}
                    onChange={(e) => onUpdate(r._id, 'ünite', e.target.value)}
                    className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-1.5 py-1 text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.konu}
                    onChange={(e) => onUpdate(r._id, 'konu', e.target.value)}
                    className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-1.5 py-1 text-zinc-900 dark:text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <textarea
                    defaultValue={JSON.stringify(r.kazanım, null, 2)}
                    onBlur={(e) => onUpdateKazanim(r._id, e.target.value)}
                    rows={6}
                    className="w-full min-w-[460px] bg-white dark:bg-black/30 border border-zinc-300 dark:border-white/10 rounded px-2 py-1.5 text-zinc-700 dark:text-gray-200 font-mono text-xs leading-relaxed outline-none focus:border-indigo-400 resize-y"
                  />
                </td>
                <td className="p-1.5 text-center">
                  <button onClick={() => onDelete(r._id)} className="text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 text-sm" title="Satırı sil">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20">
        ➕ Satır Ekle
      </button>
    </div>
  );
}
