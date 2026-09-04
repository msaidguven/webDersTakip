'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/src/context/AuthContext';

type NameOption = { id: number; name: string };
type Topic = { id: number; title: string };
type Unit = { id: number; title: string; topics: Topic[] };

type ClassicalQuestion = {
  id: number;
  questionText: string;
  svgContent: string | null;
  svgPosition: 'above' | 'below';
  topicId: number;
  topicTitle: string;
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
  const [grades, setGrades] = useState<NameOption[]>([]);
  const [lessons, setLessons] = useState<NameOption[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [myLessons, setMyLessons] = useState<NameOption[] | null>(null);

  const [gradeId, setGradeId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<number>>(new Set());

  const [questions, setQuestions] = useState<ClassicalQuestion[] | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [exporting, setExporting] = useState<ExportMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sınıf listesi — sadece bir kere, kullanıcı yetkiliyse yüklenir.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const res = await fetchJson<{ grades: NameOption[] }>('/api/ogretmen/options');
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const res = await fetchJson<{ lessons: NameOption[] }>('/api/ogretmen/options?mine=1');
      if (res.ok) setMyLessons(res.data.lessons);
    })();
  }, [user]);

  function handleGradeChange(value: string) {
    setGradeId(value);
    setLessonId('');
    setLessons([]); setUnits([]); setSelectedTopicIds(new Set()); setQuestions(null);
  }

  function handleLessonChange(value: string) {
    setLessonId(value);
    setUnits([]); setSelectedTopicIds(new Set()); setQuestions(null);
  }

  useEffect(() => {
    if (!gradeId) return;
    (async () => {
      const res = await fetchJson<{ lessons: NameOption[] }>(`/api/ogretmen/options?gradeId=${gradeId}`);
      if (res.ok) setLessons(res.data.lessons);
    })();
  }, [gradeId]);

  useEffect(() => {
    if (!gradeId || !lessonId) return;
    (async () => {
      const res = await fetchJson<{ units: Unit[] }>(`/api/ogretmen/options?gradeId=${gradeId}&lessonId=${lessonId}`);
      if (res.ok) setUnits(res.data.units);
    })();
  }, [gradeId, lessonId]);

  function toggleTopic(id: number) {
    setSelectedTopicIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleUnitTopics(unit: Unit) {
    const allSelected = unit.topics.every((t) => selectedTopicIds.has(t.id));
    setSelectedTopicIds((cur) => {
      const next = new Set(cur);
      unit.topics.forEach((t) => (allSelected ? next.delete(t.id) : next.add(t.id)));
      return next;
    });
  }

  async function handleFetchQuestions() {
    if (!selectedTopicIds.size) return;
    setQuestions(null);
    setSelectedQuestionIds(new Set());
    setLoadingQuestions(true);
    setError(null);
    const res = await fetchJson<{ questions: ClassicalQuestion[] }>(
      `/api/ogretmen/classical-questions?topicIds=${Array.from(selectedTopicIds).join(',')}`
    );
    setLoadingQuestions(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setQuestions(res.data.questions);
    setSelectedQuestionIds(new Set(res.data.questions.map((q) => q.id)));
  }

  function toggleSelectedQuestion(id: number) {
    setSelectedQuestionIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllQuestions() {
    if (!questions) return;
    setSelectedQuestionIds((cur) => (cur.size === questions.length ? new Set() : new Set(questions.map((q) => q.id))));
  }

  async function handleExport(mode: ExportMode) {
    if (!selectedQuestionIds.size) return;
    setExporting(mode);
    setError(null);
    try {
      const res = await fetch('/api/ogretmen/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIds: Array.from(selectedQuestionIds), mode }),
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

  // Sorular birden fazla konudan gelebildiği için listede konu başlığına göre grupluyoruz.
  const questionsByTopic: { topicId: number; topicTitle: string; items: ClassicalQuestion[] }[] = [];
  if (questions) {
    const order: number[] = [];
    const map = new Map<number, ClassicalQuestion[]>();
    questions.forEach((q) => {
      if (!map.has(q.topicId)) { map.set(q.topicId, []); order.push(q.topicId); }
      map.get(q.topicId)!.push(q);
    });
    order.forEach((topicId) => {
      const items = map.get(topicId)!;
      questionsByTopic.push({ topicId, topicTitle: items[0].topicTitle, items });
    });
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-default">Açık Uçlu Sorular</h1>
        <p className="text-sm text-muted-foreground mt-1">Sınıf ve ders seçtikten sonra istediğin kadar üniteden/konudan soru işaretleyip tek Word dosyasında indirebilirsin.</p>
        {myLessons && myLessons.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">Derslerim: {myLessons.map((l) => l.name).join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <select className={selectClass} value={gradeId} onChange={(e) => handleGradeChange(e.target.value)}>
          <option value="">Sınıf</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className={selectClass} value={lessonId} onChange={(e) => handleLessonChange(e.target.value)} disabled={!gradeId}>
          <option value="">Ders</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {units.length > 0 && (
        <div className="space-y-3">
          <div className="max-h-96 overflow-y-auto rounded-xl border border-default divide-y divide-default">
            {units.map((unit) => {
              const unitAllSelected = unit.topics.length > 0 && unit.topics.every((t) => selectedTopicIds.has(t.id));
              return (
                <div key={unit.id} className="p-3">
                  <label className="flex items-center gap-2 text-sm font-bold text-default cursor-pointer">
                    <input type="checkbox" checked={unitAllSelected} onChange={() => toggleUnitTopics(unit)} disabled={!unit.topics.length} />
                    {unit.title}
                  </label>
                  {unit.topics.length > 0 && (
                    <div className="mt-2 ml-6 space-y-1.5">
                      {unit.topics.map((t) => (
                        <label key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={selectedTopicIds.has(t.id)} onChange={() => toggleTopic(t.id)} />
                          {t.title}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleFetchQuestions}
            disabled={!selectedTopicIds.size || loadingQuestions}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loadingQuestions ? 'Yükleniyor...' : `Soruları Getir (${selectedTopicIds.size} konu)`}
          </button>
        </div>
      )}

      {error && <p className="text-sm font-bold text-red-500">{error}</p>}

      {questions && !loadingQuestions && questions.length === 0 && (
        <p className="text-sm text-muted-foreground">Seçtiğin konularda henüz yayında açık uçlu soru yok.</p>
      )}

      {questions && questions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-default">
              <input type="checkbox" checked={selectedQuestionIds.size === questions.length} onChange={toggleAllQuestions} />
              Tümünü seç ({selectedQuestionIds.size}/{questions.length})
            </label>
          </div>

          <div className="space-y-4">
            {questionsByTopic.map((group) => (
              <div key={group.topicId} className="space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase">{group.topicTitle}</p>
                {group.items.map((q, idx) => (
                  <label key={q.id} className="flex items-start gap-3 rounded-xl border border-default bg-surface p-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedQuestionIds.has(q.id)}
                      onChange={() => toggleSelectedQuestion(q.id)}
                    />
                    <span className="text-default">{idx + 1}. {q.questionText}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => handleExport('questions')}
              disabled={!selectedQuestionIds.size || exporting !== null}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {exporting === 'questions' ? 'Hazırlanıyor...' : 'Sadece Soruları İndir'}
            </button>
            <button
              onClick={() => handleExport('answers')}
              disabled={!selectedQuestionIds.size || exporting !== null}
              className="rounded-xl border border-default px-4 py-2.5 text-sm font-extrabold text-default hover:bg-surface disabled:opacity-50 transition-colors"
            >
              {exporting === 'answers' ? 'Hazırlanıyor...' : 'Sadece Cevap Anahtarını İndir'}
            </button>
            <button
              onClick={() => handleExport('both')}
              disabled={!selectedQuestionIds.size || exporting !== null}
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
