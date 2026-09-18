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
  source: 'pdf_upload' | 'notebooklm_json';
  unit_id: number | null;
  page_count: number | null;
  topic_count: number;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  created_at: string;
  units: { title: string } | { title: string }[] | null;
};
type TopicNoteRow = { topicId: number; topicTitle: string; recommendedHours: number | null; emphasisNotes: string | null; updatedAt: string | null };

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
  notebooklm_json: 'NotebookLM',
};

function unitTitleOf(doc: DocumentRow): string | null {
  const u = doc.units;
  const single = Array.isArray(u) ? u[0] : u;
  return single?.title || null;
}

// Öğretmen kılavuz kitabı yükleme — RagDocumentsPanel.tsx ile AYNI kalıp (sınıf/ders seç ->
// PDF Storage'a yükle -> otomatik işle; 50MB üstü için NotebookLM'e yapıştırma yolu) ama
// farklı bir tablo/bucket'a yazıyor (bkz. teacher_guide_documents.sql migration'ındaki not:
// RAG'ın öğrenci Q&A'sı için embed'lediği rag_documents'a KARIŞMAMALI). Sonuç, sadece nihai
// içerik üretim promptlarını besliyor (bkz. topicPacing.ts, topic-sections/prompt/route.ts).
export default function TeacherGuideDocumentsPanel({ initialGradeId, initialLessonId }: { initialGradeId?: number | null; initialLessonId?: number | null }) {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);

  const [gradeId, setGradeId] = useState<number | null>(initialGradeId ?? null);
  const [lessonId, setLessonId] = useState<number | null>(initialLessonId ?? null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [topicNotes, setTopicNotes] = useState<TopicNoteRow[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

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
    setLessons([]);
    if (gradeId == null) return;
    setLoadingLessons(true);
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.from('lesson_grades').select('lesson_id, lessons(id, name)').eq('grade_id', gradeId);
      const rows = ((data as LessonGradeJoin[] | null) || [])
        .map((r) => {
          const lesson = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons;
          return lesson ? { id: lesson.id, label: lesson.name } : null;
        })
        .filter((l): l is Row => !!l)
        .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
      setLessons(rows);
      setLoadingLessons(false);
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
      const res = await fetch(`/api/admin/teacher-guide/documents?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setDocuments((data.items as DocumentRow[] | null) || []);
    } finally {
      setLoadingDocs(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadTopicNotes = React.useCallback(async () => {
    if (unitId == null) {
      setTopicNotes([]);
      return;
    }
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/admin/teacher-guide/notes?unitId=${unitId}`);
      const data = await res.json();
      if (res.ok) setTopicNotes((data.items as TopicNoteRow[] | null) || []);
    } finally {
      setLoadingNotes(false);
    }
  }, [unitId]);

  useEffect(() => {
    loadTopicNotes();
  }, [loadTopicNotes]);

  const importedUnitIds = React.useMemo(
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
      const supabase = createStorageClient();
      // Storage key'i Türkçe karakter/boşluk/parantez gibi geçersiz baytlar içermesin diye
      // dosya adından bağımsız tutuyoruz — okunabilir ad zaten ayrıca "fileName" olarak
      // gönderilip "title" alanına yazılıyor, storage key'in kendisi sadece uzantıyı taşıyor.
      const extMatch = file.name.match(/\.[a-zA-Z0-9]+$/);
      const storagePath = `${gradeId}-${lessonId}/${Date.now()}${extMatch ? extMatch[0] : '.pdf'}`;
      const { error: uploadError } = await supabase.storage
        .from('teacher-guide-documents')
        .upload(storagePath, file, { contentType: 'application/pdf' });
      if (uploadError) {
        showNotice('error', `Yükleme başarısız: ${uploadError.message}`);
        return;
      }

      const res = await fetch('/api/admin/teacher-guide/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, filePath: storagePath, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'İşleme başlatılamadı');
        return;
      }
      showNotice('success', 'Kılavuz kitap işlendi ve konu notları kaydedildi');
      loadDocuments();
      loadTopicNotes();
    } catch {
      showNotice('error', 'Yükleme sırasında hata oluştu');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Bu kılavuz belgesini ve ürettiği konu notlarını silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/admin/teacher-guide/documents/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Silinemedi');
      return;
    }
    showNotice('success', 'Belge silindi');
    loadDocuments();
    loadTopicNotes();
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
        <h3 className="text-foreground font-semibold mb-1">Öğretmen Kılavuz Kitabı</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Kılavuz kitaptaki önerilen ders saati ve vurgulanacak noktalar, öğrenciye gösterilecek içerik üretim promptlarına eklenir — RAG kaynak sistemine dokunmaz.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Sınıf" value={gradeId} onChange={setGradeId} options={grades} />
          <Select label="Ders" value={lessonId} onChange={setLessonId} options={lessons} disabled={gradeId == null || loadingLessons} />
          <Select
            label="Ünite (notlara bakmak/NotebookLM için)"
            value={unitId}
            onChange={setUnitId}
            options={units.map((u) => ({ id: u.id, label: importedUnitIds.has(u.id) ? `✅ ${u.title}` : u.title }))}
            disabled={lessonId == null}
          />
        </div>
      </div>

      {gradeId != null && lessonId != null && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground font-semibold">PDF Yükle (50MB altı)</h3>
            <label className={`px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-muted text-muted-foreground' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'}`}>
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
          <p className="text-xs text-muted-foreground">
            Kılavuz kitabın tamamını (birden fazla ünite kapsayabilir) tek seferde yükleyebilirsiniz — her ünite otomatik tespit edilip konularına göre yapılandırılır. 50MB üstü kitaplar için aşağıdaki NotebookLM akışını kullanın.
          </p>
        </div>
      )}

      {gradeId != null && lessonId != null && (
        <NotebookLmLessonJsonUploader
          gradeId={gradeId}
          lessonId={lessonId}
          onSaved={(count) => {
            showNotice('success', `${count} konu için kılavuz notu kaydedildi`);
            loadDocuments();
            loadTopicNotes();
          }}
          onError={(msg) => showNotice('error', msg)}
        />
      )}

      {unitId != null && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="text-foreground font-semibold mb-4">Bu Ünitenin Konu Notları</h3>
          {loadingNotes ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : topicNotes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bu ünitede konu yok.</p>
          ) : (
            <div className="space-y-2">
              {topicNotes.map((n) => (
                <div key={n.topicId} className="p-3 rounded-xl bg-surface">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-foreground text-sm font-medium">{n.topicTitle}</p>
                    {n.recommendedHours != null ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 shrink-0">~{n.recommendedHours} ders saati</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">Süre bilgisi yok</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs mt-1 whitespace-pre-line">
                    {n.emphasisNotes || 'Vurgu notu yok'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {gradeId != null && lessonId != null && (
        <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
          <h3 className="text-foreground font-semibold mb-4">Yüklenen Kılavuz Belgeleri</h3>
          {loadingDocs ? (
            <p className="text-muted-foreground text-sm">Yükleniyor…</p>
          ) : documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bu sınıf/ders için henüz kılavuz belgesi eklenmemiş.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground text-sm truncate">{doc.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{SOURCE_LABEL[doc.source]}</span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {unitTitleOf(doc) ? `${unitTitleOf(doc)} · ` : ''}
                      {doc.status === 'ready' && (doc.page_count ? `${doc.page_count} sayfa · ${doc.topic_count} konu` : `${doc.topic_count} konu`)}
                      {doc.status === 'failed' && doc.error_message}
                      {doc.status === 'processing' && 'İşleniyor…'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLOR[doc.status]}`}>{STATUS_LABEL[doc.status]}</span>
                  <button onClick={() => handleDelete(doc.id)} className="text-xs px-3 py-1.5 rounded-lg text-red-300 hover:bg-red-500/10 shrink-0">
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

function NotebookLmLessonJsonUploader({
  gradeId, lessonId, onSaved, onError,
}: {
  gradeId: number;
  lessonId: number;
  onSaved: (count: number) => void;
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
      const res = await fetch(`/api/admin/teacher-guide/lesson-prompt?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json();
      if (res.ok) setPrompt(data.prompt);
      else onError(data.error || 'Prompt oluşturulamadı');
      setLoadingPrompt(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeId, lessonId]);

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
      const res = await fetch('/api/admin/teacher-guide/documents/from-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, json: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'Kaydedilemedi');
        return;
      }
      setPasted('');
      onSaved(data.savedTopicCount || 0);
    } catch {
      onError('Kaydetme sırasında hata oluştu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-6">
      <h3 className="text-foreground font-semibold mb-1">NotebookLM ile Dersin Tamamını Ekle (50MB üstü kılavuz kitaplar için)</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Kılavuz kitaplar kısa olduğundan tüm üniteler tek promptta isteniyor. Bu prompt&apos;u, kaynak olarak kılavuz kitabın PDF&apos;ini yüklediğin NotebookLM notebook&apos;unda sor; dönen JSON&apos;u aşağıya yapıştırıp kaydet.
      </p>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Prompt</span>
          <button
            onClick={handleCopy}
            disabled={loadingPrompt || !prompt}
            className="text-xs px-3 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-accent disabled:opacity-40"
          >
            {copied ? 'Kopyalandı ✓' : 'Kopyala'}
          </button>
        </div>
        <textarea
          readOnly
          value={loadingPrompt ? 'Yükleniyor…' : prompt}
          rows={6}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1.5">NotebookLM&apos;in JSON çıktısını buraya yapıştır</label>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          disabled={saving}
          placeholder="NotebookLM'den dönen JSON'u buraya yapıştırın…"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-60 resize-y font-mono"
        />
        <button
          onClick={handleSave}
          disabled={saving || !pasted.trim()}
          className="mt-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-40"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
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
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground disabled:opacity-40"
      >
        <option value="" className="bg-popover text-popover-foreground">Seçin…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-popover text-popover-foreground">{o.label}</option>
        ))}
      </select>
    </div>
  );
}
