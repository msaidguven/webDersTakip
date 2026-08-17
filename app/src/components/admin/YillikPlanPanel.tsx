'use client';

// Yıllık Plan Yükleme — DOCX yıllık plan tablosunu okuyup Üniteler/Konular/Kazanımlar
// olarak Supabase'e aktarır. Eski yillik_plan/ (Python/Flask) aracının React portu;
// topic_contents'e hiç dokunmaz — bkz. app/src/lib/yillikPlan/importer.ts üstündeki not.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

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

const STEP_ENDPOINTS: Record<StepKey, string> = {
  units: '/api/admin/yillik-plan/import-units',
  topics: '/api/admin/yillik-plan/import-topics',
  outcomes: '/api/admin/yillik-plan/import-outcomes',
};

export default function YillikPlanPanel() {
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

      {/* DOSYA YÜKLE */}
      <Card title="1 · DOCX Yükle">
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
            dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
          }`}
        >
          <input
            type="file"
            accept=".docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-bold text-white">DOCX sürükle veya tıkla</p>
          <p className="text-xs text-gray-500 mt-1">Yıllık plan tablosu içeren .docx dosyası</p>
          {fileName && <p className="text-xs font-semibold text-indigo-300 mt-3">{parsing ? '⏳ ' : '✅ '}{fileName}</p>}
        </div>
        {parseError && <p className="text-sm text-red-400 mt-3">❌ {parseError}</p>}

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
                  <span key={u} className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {u}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => setEditorOpen((v) => !v)}
              className="text-xs font-bold text-indigo-300 hover:text-indigo-200"
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
            <summary className="text-xs font-bold text-gray-400 cursor-pointer">Ham JSON olarak düzenle</summary>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full mt-2 rounded-lg border border-white/10 bg-black/40 p-3 text-xs font-mono text-emerald-300 resize-y outline-none focus:border-indigo-400"
            />
            <div className="flex items-center gap-3 mt-2">
              <button onClick={applyRawJson} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-400">
                JSON&apos;u Uygula
              </button>
              {rawJsonError && <span className="text-xs text-red-400">❌ {rawJsonError}</span>}
            </div>
          </details>
        </Card>
      )}

      {/* DERS / SINIF SEÇ */}
      <Card title="2 · Ders ve Sınıf Seç">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PickList label="Ders" items={lessons} selectedId={lessonId} onSelect={setLessonId} />
          <PickList label="Sınıf" items={grades} selectedId={gradeId} onSelect={setGradeId} />
        </div>
      </Card>

      {/* IMPORT ADIMLARI */}
      <Card title="3 · Aktar">
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
            description="Kazanımlar outcomes tablosuna, geçtiği haftalar outcome_weeks'e (start/end) eklenir."
            ready={ready}
            running={stepRunning.outcomes}
            logs={stepLogs.outcomes}
            result={stepResult.outcomes}
            onRun={() => runStep('outcomes')}
          />
        </div>
      </Card>
    </div>
  );
}

// ==================== ALT BİLEŞENLER ====================

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111114] rounded-2xl border border-white/5 p-5 sm:p-6">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/5 p-3 text-center">
      <div className="text-lg font-mono font-bold text-emerald-400">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5">{label}</div>
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
                s.done ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400' : 'border-white/10 text-gray-500'
              }`}
            >
              {s.done ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-bold ${s.done ? 'text-emerald-400' : 'text-gray-500'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 max-w-10 ${s.done ? 'bg-emerald-400' : 'bg-white/10'}`} />
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {items.length === 0 && <p className="text-xs text-gray-500 py-2 text-center">Yükleniyor…</p>}
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm font-semibold transition-colors ${
              selectedId === item.id
                ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${selectedId === item.id ? 'bg-indigo-400' : 'bg-white/20'}`} />
            <span className="flex-1 truncate">{item.name}</span>
            <span className="text-[10px] font-mono text-gray-500">#{item.id}</span>
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
    <div className="rounded-xl border border-white/5 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
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
          <span className="text-emerald-400">✅ {result.basarili}</span>
          <span className="text-gray-500">⊘ {result.atlanmis}</span>
          <span className="text-red-400">❌ {result.hata}</span>
          {result.hafta_atlanmis != null && <span className="text-gray-500">📅 ⊘{result.hafta_atlanmis}</span>}
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-3 bg-black/40 rounded-lg border border-white/5 p-3 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed">
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.level === 'success' ? 'text-emerald-400' :
                l.level === 'error' ? 'text-red-400' :
                l.level === 'warning' ? 'text-amber-400' : 'text-gray-400'
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
      <div className="max-h-[600px] overflow-auto rounded-lg border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#1a1a20]">
            <tr>
              <th className="text-left font-bold text-gray-400 p-2 w-16">Hafta</th>
              <th className="text-left font-bold text-gray-400 p-2 min-w-[140px]">Ünite</th>
              <th className="text-left font-bold text-gray-400 p-2 min-w-[140px]">Konu</th>
              <th className="text-left font-bold text-gray-400 p-2 min-w-[480px]">Kazanımlar (JSON)</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-white/5">
                <td className="p-1.5">
                  <input
                    type="number"
                    value={r.week_no ?? ''}
                    onChange={(e) => onUpdate(r._id, 'week_no', e.target.value)}
                    className="w-14 bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.ünite}
                    onChange={(e) => onUpdate(r._id, 'ünite', e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    value={r.konu}
                    onChange={(e) => onUpdate(r._id, 'konu', e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-white outline-none focus:border-indigo-400"
                  />
                </td>
                <td className="p-1.5">
                  <textarea
                    defaultValue={JSON.stringify(r.kazanım, null, 2)}
                    onBlur={(e) => onUpdateKazanim(r._id, e.target.value)}
                    rows={6}
                    className="w-full min-w-[460px] bg-black/30 border border-white/10 rounded px-2 py-1.5 text-gray-200 font-mono text-xs leading-relaxed outline-none focus:border-indigo-400 resize-y"
                  />
                </td>
                <td className="p-1.5 text-center">
                  <button onClick={() => onDelete(r._id)} className="text-red-400 hover:text-red-300 text-sm" title="Satırı sil">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20">
        ➕ Satır Ekle
      </button>
    </div>
  );
}
