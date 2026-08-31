'use client';

import React, { useEffect, useState } from 'react';
import { createClient, createStorageClient } from '@/utils/supabase/client';

type Row = { id: number; label: string };
type LessonGradeJoin = {
  lesson_id: number;
  lessons: { id: number; name: string } | { id: number; name: string }[] | null;
};
type UnitRow = { id: number; title: string; order_no: number };
type DocumentRow = {
  id: number;
  title: string;
  source: 'pdf_upload' | 'notebooklm_text';
  unit_id: number | null;
  page_count: number | null;
  chunk_count: number;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  created_at: string;
  units: { title: string } | { title: string }[] | null;
};

const STATUS_LABEL: Record<DocumentRow['status'], string> = {
  processing: 'İşleniyor',
  ready: 'Hazır',
  failed: 'Hata',
};
const STATUS_COLOR: Record<DocumentRow['status'], string> = {
  processing: 'bg-amber-500/20 text-amber-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
};
const SOURCE_LABEL: Record<DocumentRow['source'], string> = {
  pdf_upload: 'PDF',
  notebooklm_text: 'NotebookLM',
};

function unitTitleOf(doc: DocumentRow): string | null {
  const u = doc.units;
  const single = Array.isArray(u) ? u[0] : u;
  return single?.title || null;
}

// Ders notu PDF'leri konu/üniteye göre değil, sınıf+ders (kitap) bazında
// ayrılıyor (ör. "5. Sınıf Sosyal Bilgiler 1" ve "... 2" aynı ders+sınıfın iki
// cildi) — bu yüzden seçim burada sadece iki kademeli: Sınıf -> Ders. Ünite
// seçimi sadece NotebookLM'e ünite bazlı prompt üretmek için kullanılıyor.
export default function RagDocumentsPanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('grades').select('id, name').eq('is_active', true).order('order_no');
      setGrades(((data as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));
    })();
  }, []);

  useEffect(() => {
    setLessonId(null);
    setLessons([]);
    if (gradeId == null) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('lesson_grades')
        .select('lesson_id, lessons(id, name)')
        .eq('grade_id', gradeId);
      const rows = ((data as LessonGradeJoin[] | null) || [])
        .map((r) => {
          const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons;
          return lesson ? { id: lesson.id, label: lesson.name } : null;
        })
        .filter((l): l is Row => !!l)
        .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
      setLessons(rows);
    })();
  }, [gradeId]);

  useEffect(() => {
    setUnitId(null);
    setUnits([]);
    if (gradeId == null || lessonId == null) return;
    (async () => {
      const res = await fetch(`/api/admin/manage/units?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setUnits(((data.items as UnitRow[] | null) || []).sort((a, b) => a.order_no - b.order_no));
    })();
  }, [gradeId, lessonId]);

  const loadDocuments = React.useCallback(async () => {
    if (gradeId == null || lessonId == null) {
      setDocuments([]);
      return;
    }
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/admin/rag/documents?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setDocuments((data.items as DocumentRow[] | null) || []);
    } finally {
      setLoadingDocs(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Bir ünitenin yanında ✅ göstermek için: o ünite için en az bir 'ready'
  // kaynak var mı? (NotebookLM metinleri unit_id taşır; tüm kitabı kapsayan PDF
  // yüklemelerinin unit_id'si olmadığı için onlar tek tek üniteleri işaretlemez.)
  const readyUnitIds = React.useMemo(
    () => new Set(documents.filter((d) => d.status === 'ready' && d.unit_id != null).map((d) => d.unit_id as number)),
    [documents]
  );

  async function handleUpload(file: File) {
    if (gradeId == null || lessonId == null) return;
    if (file.type !== 'application/pdf') {
      showNotice('error', 'Sadece PDF yükleyebilirsiniz');
      return;
    }
    setUploading(true);
    try {
      // Dosya, Vercel function'ların istek boyutu limitine (~4.5MB) takılmaması
      // için API route'a değil, doğrudan tarayıcıdan Supabase Storage'a yükleniyor.
      // createClient() değil createStorageClient() kullanılıyor çünkü createClient()
      // her isteğe zorla "Content-Type: application/json" ekliyor ve bu, multipart
      // dosya yüklemesini bozuyor.
      const supabase = createStorageClient();
      const storagePath = `${gradeId}-${lessonId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('rag-documents')
        .upload(storagePath, file, { contentType: 'application/pdf' });
      if (uploadError) {
        showNotice('error', `Yükleme başarısız: ${uploadError.message}`);
        return;
      }

      const res = await fetch('/api/admin/rag/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, filePath: storagePath, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'İşleme başlatılamadı');
        return;
      }
      showNotice('success', 'PDF işlendi ve parçalara ayrılıp kaydedildi');
      loadDocuments();
    } catch {
      showNotice('error', 'Yükleme sırasında hata oluştu');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Bu belgeyi ve tüm parçalarını silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/admin/rag/documents/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Silinemedi');
      return;
    }
    showNotice('success', 'Belge silindi');
    loadDocuments();
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      <div className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
        <h3 className="text-white font-semibold mb-4">Sınıf, Ders ve Ünite Seç</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Sınıf" value={gradeId} onChange={setGradeId} options={grades} />
          <Select label="Ders" value={lessonId} onChange={setLessonId} options={lessons} disabled={gradeId == null} />
          <Select
            label="Ünite (NotebookLM için)"
            value={unitId}
            onChange={setUnitId}
            options={units.map((u) => ({ id: u.id, label: readyUnitIds.has(u.id) ? `✅ ${u.title}` : u.title }))}
            disabled={lessonId == null}
          />
        </div>

        {units.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 mb-2">Ünite ilerlemesi — hangi ünitelerin NotebookLM metni eklendiğini gösterir, PDF yüklemesini kapsamaz:</p>
            <div className="flex flex-wrap gap-2">
              {units.map((u) => {
                const done = readyUnitIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnitId(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      done
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    } ${unitId === u.id ? 'ring-1 ring-indigo-400' : ''}`}
                  >
                    {done ? '✅' : '⬜'} {u.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {gradeId != null && lessonId != null && (
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">PDF Yükle (50MB altı)</h3>
            <label className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-white/5 text-gray-500' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'}`}>
              {uploading ? 'Yükleniyor…' : '+ PDF Yükle'}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            Aynı sınıf/ders için birden fazla cilt yükleyebilirsiniz (ör. &quot;Sosyal Bilgiler 1&quot;, &quot;Sosyal Bilgiler 2&quot;) — hepsi tek bir arama kapsamında birleşir. Supabase Free plan yükleme boyutu 50MB ile sınırlı; daha büyük PDF'ler için aşağıdaki NotebookLM akışını kullanın.
          </p>
        </div>
      )}

      {gradeId != null && lessonId != null && unitId != null && (
        <NotebookLmUnitUploader
          gradeId={gradeId}
          lessonId={lessonId}
          unitId={unitId}
          onSaved={() => {
            showNotice('success', 'Ünite metni işlendi ve parçalara ayrılıp kaydedildi');
            loadDocuments();
          }}
          onError={(msg) => showNotice('error', msg)}
        />
      )}

      {gradeId != null && lessonId != null && (
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4">Kaynaklar</h3>
          {loadingDocs ? (
            <p className="text-gray-500 text-sm">Yükleniyor…</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500 text-sm">Bu sınıf/ders için henüz kaynak eklenmemiş.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm truncate">{doc.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 shrink-0">{SOURCE_LABEL[doc.source]}</span>
                    </div>
                    <p className="text-gray-500 text-xs">
                      {unitTitleOf(doc) ? `${unitTitleOf(doc)} · ` : ''}
                      {doc.status === 'ready' && (doc.page_count ? `${doc.page_count} sayfa · ${doc.chunk_count} parça` : `${doc.chunk_count} parça`)}
                      {doc.status === 'failed' && doc.error_message}
                      {doc.status === 'processing' && 'İşleniyor…'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLOR[doc.status]}`}>{STATUS_LABEL[doc.status]}</span>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-red-300 hover:bg-red-500/10 shrink-0"
                  >
                    Sil
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotebookLmUnitUploader({
  gradeId, lessonId, unitId, onSaved, onError,
}: {
  gradeId: number;
  lessonId: number;
  unitId: number;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoadingPrompt(true);
    setPrompt('');
    setPasted('');
    (async () => {
      const res = await fetch(`/api/admin/rag/unit-prompt?unitId=${unitId}`);
      const data = await res.json();
      if (res.ok) setPrompt(data.prompt);
      else onError(data.error || 'Prompt oluşturulamadı');
      setLoadingPrompt(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    const text = pasted.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/rag/documents/from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, unitId, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'Kaydedilemedi');
        return;
      }
      setPasted('');
      onSaved();
    } catch {
      onError('Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
      <h3 className="text-white font-semibold mb-1">NotebookLM ile Ünite Ekle (50MB üstü PDF'ler için)</h3>
      <p className="text-xs text-gray-500 mb-4">
        Bu prompt&apos;u, kaynak olarak kitabın PDF&apos;ini yüklediğin NotebookLM notebook&apos;unda sor; dönen düz metni aşağıya yapıştırıp kaydet. Kitabı tamamen kapsamak için her üniteyi ayrı ayrı yapmanız gerekir.
      </p>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">Prompt</span>
          <button
            onClick={handleCopy}
            disabled={loadingPrompt || !prompt}
            className="text-xs px-3 py-1 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40"
          >
            {copied ? 'Kopyalandı ✓' : 'Kopyala'}
          </button>
        </div>
        <textarea
          readOnly
          value={loadingPrompt ? 'Yükleniyor…' : prompt}
          rows={6}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1.5">NotebookLM&apos;in düz metin çıktısını buraya yapıştır</label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          disabled={saving}
          placeholder="NotebookLM'den dönen metni buraya yapıştırın…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60 resize-y"
        />
        <button
          onClick={handleSave}
          disabled={saving || !pasted.trim()}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
        >
          {saving ? 'Kaydediliyor…' : 'Parçala, Embed\'le ve Kaydet'}
        </button>
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options, disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  options: Row[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-40"
      >
        <option value="" className="bg-[#1a1a1e] text-white">Seçin…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-[#1a1a1e] text-white">{o.label}</option>
        ))}
      </select>
    </div>
  );
}
