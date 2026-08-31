'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Row = { id: number; label: string };
type LessonGradeJoin = {
  lesson_id: number;
  lessons: { id: number; name: string } | { id: number; name: string }[] | null;
};
type DocumentRow = {
  id: number;
  title: string;
  page_count: number | null;
  chunk_count: number;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  created_at: string;
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

// Ders notu PDF'leri konu/üniteye göre değil, sınıf+ders (kitap) bazında
// ayrılıyor (ör. "5. Sınıf Sosyal Bilgiler 1" ve "... 2" aynı ders+sınıfın iki
// cildi) — bu yüzden seçim burada sadece iki kademeli: Sınıf -> Ders.
export default function RagDocumentsPanel() {
  const [grades, setGrades] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);

  const [gradeId, setGradeId] = useState<number | null>(null);
  const [lessonId, setLessonId] = useState<number | null>(null);

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

  async function handleUpload(file: File) {
    if (gradeId == null || lessonId == null) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gradeId', String(gradeId));
      formData.append('lessonId', String(lessonId));
      const res = await fetch('/api/admin/rag/documents', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Yükleme başarısız');
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
        <h3 className="text-white font-semibold mb-4">Sınıf ve Ders Seç</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Sınıf" value={gradeId} onChange={setGradeId} options={grades} />
          <Select label="Ders" value={lessonId} onChange={setLessonId} options={lessons} disabled={gradeId == null} />
        </div>
      </div>

      {gradeId != null && lessonId != null && (
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Ders Notu PDF&apos;leri</h3>
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
          <p className="text-xs text-gray-500 mb-4">
            Aynı sınıf/ders için birden fazla cilt yükleyebilirsiniz (ör. &quot;Sosyal Bilgiler 1&quot;, &quot;Sosyal Bilgiler 2&quot;) — hepsi tek bir arama kapsamında birleşir.
          </p>

          {loadingDocs ? (
            <p className="text-gray-500 text-sm">Yükleniyor…</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500 text-sm">Bu sınıf/ders için henüz ders notu yüklenmemiş.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{doc.title}</p>
                    <p className="text-gray-500 text-xs">
                      {doc.status === 'ready' && `${doc.page_count ?? '?'} sayfa · ${doc.chunk_count} parça`}
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
        <option value="">Seçin…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
