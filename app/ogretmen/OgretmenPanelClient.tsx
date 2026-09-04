'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/src/context/AuthContext';

type Option = { id: number; title?: string; name?: string };
type ClassicalQuestion = {
  id: number;
  questionText: string;
  svgContent: string | null;
  svgPosition: 'above' | 'below';
  modelAnswer: string | null;
  keyTerms: string[];
};

type ExportMode = 'questions' | 'answers' | 'both';

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, error: data?.error || 'Bir hata oluştu' };
  return { ok: true, data };
}

export default function OgretmenPanelClient() {
  const { user, loading: authLoading } = useAuth();

  const [forbidden, setForbidden] = useState(false);
  const [grades, setGrades] = useState<Option[]>([]);
  const [lessons, setLessons] = useState<Option[]>([]);
  const [units, setUnits] = useState<Option[]>([]);
  const [topics, setTopics] = useState<Option[]>([]);

  const [gradeId, setGradeId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [topicId, setTopicId] = useState('');

  const [questions, setQuestions] = useState<ClassicalQuestion[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [exporting, setExporting] = useState<ExportMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sınıf listesi — sadece bir kere, kullanıcı yetkiliyse yüklenir.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const res = await fetchJson<{ grades: Option[] }>('/api/ogretmen/options');
      if (cancelled) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setForbidden(true);
        else setError(res.error);
        return;
      }
      setGrades(res.data.grades);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Kademeli seçimde bir üst seviye değişince alttakileri sıfırlamak bir "effect"
  // işi değil (state'i state'e senkronize etmek) — doğrudan onChange handler'ında
  // yapılıyor; effect'ler sadece geçerli id için veri çekiyor.
  function handleGradeChange(value: string) {
    setGradeId(value);
    setLessonId(''); setUnitId(''); setTopicId('');
    setLessons([]); setUnits([]); setTopics([]); setQuestions(null);
  }

  function handleLessonChange(value: string) {
    setLessonId(value);
    setUnitId(''); setTopicId('');
    setUnits([]); setTopics([]); setQuestions(null);
  }

  function handleUnitChange(value: string) {
    setUnitId(value);
    setTopicId('');
    setTopics([]); setQuestions(null);
  }

  useEffect(() => {
    if (!gradeId) return;
    (async () => {
      const res = await fetchJson<{ lessons: Option[] }>(`/api/ogretmen/options?gradeId=${gradeId}`);
      if (res.ok) setLessons(res.data.lessons);
    })();
  }, [gradeId]);

  useEffect(() => {
    if (!gradeId || !lessonId) return;
    (async () => {
      const res = await fetchJson<{ units: Option[] }>(`/api/ogretmen/options?gradeId=${gradeId}&lessonId=${lessonId}`);
      if (res.ok) setUnits(res.data.units);
    })();
  }, [gradeId, lessonId]);

  useEffect(() => {
    if (!unitId) return;
    (async () => {
      const res = await fetchJson<{ topics: Option[] }>(`/api/ogretmen/options?unitId=${unitId}`);
      if (res.ok) setTopics(res.data.topics);
    })();
  }, [unitId]);

  useEffect(() => {
    if (!topicId) return;
    (async () => {
      setSelectedIds(new Set());
      setLoadingQuestions(true);
      setError(null);
      const res = await fetchJson<{ questions: ClassicalQuestion[] }>(`/api/ogretmen/classical-questions?topicId=${topicId}`);
      setLoadingQuestions(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setQuestions(res.data.questions);
      setSelectedIds(new Set(res.data.questions.map((q) => q.id)));
    })();
  }, [topicId]);

  function toggleSelected(id: number) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!questions) return;
    setSelectedIds((cur) => (cur.size === questions.length ? new Set() : new Set(questions.map((q) => q.id))));
  }

  async function handleExport(mode: ExportMode) {
    if (!selectedIds.size) return;
    setExporting(mode);
    setError(null);
    try {
      const res = await fetch('/api/ogretmen/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: Array.from(selectedIds), mode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'İndirme başarısız oldu');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || 'sorular.docx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Ağ hatası oluştu');
    } finally {
      setExporting(null);
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto mt-16 rounded-2xl bg-surface-elevated border border-default p-8 text-center">
        <p className="text-default font-medium mb-1">Öğretmen paneli için giriş yapmalısın</p>
        <Link href="/login?redirectTo=/ogretmen" className="inline-block mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium">
          Giriş Yap
        </Link>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto mt-16 rounded-2xl bg-surface-elevated border border-default p-8 text-center">
        <p className="text-default font-medium mb-1">Bu sayfa sadece onaylı öğretmen hesapları içindir</p>
        <p className="text-muted-foreground text-sm">Öğretmen hesabı talebiniz varsa yönetici ile iletişime geçin.</p>
      </div>
    );
  }

  const selectClass = 'w-full rounded-xl border border-default bg-surface p-2.5 text-sm text-default focus:border-indigo-500 outline-none disabled:opacity-50';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-default">Açık Uçlu Sorular</h1>
        <p className="text-sm text-muted-foreground mt-1">Sınıf, ders, ünite ve konu seçip yayındaki açık uçlu soruları Word olarak indirebilirsin.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <select className={selectClass} value={gradeId} onChange={(e) => handleGradeChange(e.target.value)}>
          <option value="">Sınıf</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={selectClass} value={lessonId} onChange={(e) => handleLessonChange(e.target.value)} disabled={!gradeId}>
          <option value="">Ders</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select className={selectClass} value={unitId} onChange={(e) => handleUnitChange(e.target.value)} disabled={!lessonId}>
          <option value="">Ünite</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
        </select>
        <select className={selectClass} value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!unitId}>
          <option value="">Konu</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}

      {loadingQuestions && <p className="text-sm text-muted-foreground">Sorular yükleniyor...</p>}

      {questions && !loadingQuestions && questions.length === 0 && (
        <p className="text-sm text-muted-foreground">Bu konuda henüz yayında açık uçlu soru yok.</p>
      )}

      {questions && questions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-default">
              <input type="checkbox" checked={selectedIds.size === questions.length} onChange={toggleAll} />
              Tümünü seç ({selectedIds.size}/{questions.length})
            </label>
          </div>

          <div className="space-y-2">
            {questions.map((q, idx) => (
              <label key={q.id} className="flex items-start gap-3 rounded-xl border border-default bg-surface p-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleSelected(q.id)}
                />
                <span className="text-default">{idx + 1}. {q.questionText}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => handleExport('questions')}
              disabled={!selectedIds.size || exporting !== null}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {exporting === 'questions' ? 'Hazırlanıyor...' : 'Sadece Soruları İndir'}
            </button>
            <button
              onClick={() => handleExport('answers')}
              disabled={!selectedIds.size || exporting !== null}
              className="rounded-xl border border-default px-4 py-2.5 text-sm font-extrabold text-default hover:bg-surface disabled:opacity-50 transition-colors"
            >
              {exporting === 'answers' ? 'Hazırlanıyor...' : 'Sadece Cevap Anahtarını İndir'}
            </button>
            <button
              onClick={() => handleExport('both')}
              disabled={!selectedIds.size || exporting !== null}
              className="rounded-xl border border-default px-4 py-2.5 text-sm font-extrabold text-default hover:bg-surface disabled:opacity-50 transition-colors"
            >
              {exporting === 'both' ? 'Hazırlanıyor...' : 'İkisi Bir Arada İndir'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
