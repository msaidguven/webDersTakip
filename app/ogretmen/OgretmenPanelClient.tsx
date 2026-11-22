'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/src/context/AuthContext';
import { useProfileRole } from '@/app/src/hooks/useIsAdmin';
import { pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import r from '@/app/src/components/robotic/robotic.module.css';
import { OgretmenTabs } from './OgretmenTabs';

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
  const role = useProfileRole();
  const isStaff = role === 'teacher' || role === 'admin';

  const [forbidden, setForbidden] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
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
    if (!user || (role !== null && !isStaff)) return;
    let cancelled = false;
    (async () => {
      const res = await fetchJson<{ grades: NameOption[] }>('/api/ogretmen/options');
      if (cancelled) return;
      setAccessChecked(true);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setForbidden(true);
        else setError(res.error);
        return;
      }
      setGrades(res.data.grades);
    })();
    return () => { cancelled = true; };
  }, [user, role, isStaff]);

  useEffect(() => {
    if (!user || !isStaff) return;
    (async () => {
      const res = await fetchJson<{ lessons: NameOption[] }>('/api/ogretmen/options?mine=1');
      if (res.ok) setMyLessons(res.data.lessons);
    })();
  }, [user, isStaff]);

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

  const shell = (children: React.ReactNode) => (
    <div className={pageShellCls}>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</div>
    </div>
  );

  if (authLoading || (user && role === null && !accessChecked)) {
    return shell(
      <div aria-busy="true" aria-label="Öğretmen paneli yükleniyor" className={`h-48 animate-pulse rounded-[22px] ${r.panel}`} />
    );
  }

  if (!user) {
    return shell(
      <div className={`mx-auto mt-10 max-w-xl p-8 text-center ${r.panel}`}>
        <p className="text-lg font-bold text-default">Öğretmen paneli için giriş yapmalısın</p>
        <Link href="/login?redirectTo=/ogretmen" className={`mt-5 inline-flex min-h-10 items-center rounded-xl px-5 text-sm font-bold ${r.btnNeon} ${r.btnText}`}>
          Giriş Yap
        </Link>
      </div>
    );
  }

  if (forbidden || (role !== null && !isStaff)) {
    return shell(
      <div className={`mx-auto mt-10 max-w-xl p-8 text-center ${r.panel}`}>
        <p className="text-lg font-bold text-default">Bu sayfa sadece öğretmen hesapları içindir</p>
        <p className="mt-2 text-sm text-muted-foreground">Öğretmen hesabıyla giriş yaptığında bu araçları kullanabilirsin.</p>
      </div>
    );
  }

  const selectClass = `w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-default outline-none disabled:opacity-50 ${r.item}`;

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

  return shell(
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={r.label}>Öğretmen paneli</p>
          <h1 className={`mt-1 text-2xl font-bold uppercase text-default sm:text-3xl ${r.display}`}>Açık Uçlu Sorular</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sınıf ve ders seçtikten sonra istediğin kadar üniteden/konudan soru işaretleyip tek Word dosyasında indirebilirsin.</p>
          {myLessons && myLessons.length > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">Derslerim: {myLessons.map((l) => l.name).join(', ')}</p>
          )}
        </div>
        <OgretmenTabs active="/ogretmen" />
      </div>

      <section className={`space-y-4 rounded-[22px] p-5 sm:p-6 ${r.panel}`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className={selectClass} value={gradeId} onChange={(e) => handleGradeChange(e.target.value)}>
            <option value="">Sınıf seç</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className={selectClass} value={lessonId} onChange={(e) => handleLessonChange(e.target.value)} disabled={!gradeId}>
            <option value="">Ders seç</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {units.length > 0 && (
          <div className="space-y-4">
            <div className={`max-h-96 overflow-y-auto rounded-2xl border divide-y divide-[var(--border)] ${r.divider}`}>
              {units.map((unit) => {
                const unitAllSelected = unit.topics.length > 0 && unit.topics.every((t) => selectedTopicIds.has(t.id));
                return (
                  <div key={unit.id} className="p-3.5">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-bold text-default">
                      <input type="checkbox" checked={unitAllSelected} onChange={() => toggleUnitTopics(unit)} disabled={!unit.topics.length} />
                      {unit.title}
                    </label>
                    {unit.topics.length > 0 && (
                      <div className="ml-6 mt-2 space-y-1.5">
                        {unit.topics.map((t) => (
                          <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-default">
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
              className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-50 ${r.btnNeon} ${r.btnText}`}
            >
              {loadingQuestions ? 'Yükleniyor...' : `Soruları Getir (${selectedTopicIds.size} konu)`}
            </button>
          </div>
        )}
      </section>

      {error && <p role="alert" className="text-sm font-bold text-rose-500">{error}</p>}

      {questions && !loadingQuestions && questions.length === 0 && (
        <p className={`rounded-[22px] p-6 text-sm text-muted-foreground ${r.panel}`}>Seçtiğin konularda henüz yayında açık uçlu soru yok.</p>
      )}

      {questions && questions.length > 0 && (
        <section className={`space-y-5 rounded-[22px] p-5 sm:p-6 ${r.panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-default">
              <input type="checkbox" checked={selectedQuestionIds.size === questions.length} onChange={toggleAllQuestions} />
              Tümünü seç ({selectedQuestionIds.size}/{questions.length})
            </label>
          </div>

          <div className="space-y-5">
            {questionsByTopic.map((group) => (
              <div key={group.topicId} className="space-y-2.5">
                <p className={r.label}>{group.topicTitle}</p>
                {group.items.map((q, idx) => (
                  <label key={q.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 text-sm ${r.item}`}>
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={selectedQuestionIds.has(q.id)}
                      onChange={() => toggleSelectedQuestion(q.id)}
                    />
                    <span className="min-w-0 flex-1 leading-relaxed text-default">{idx + 1}. {q.questionText}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className={`flex flex-wrap gap-2.5 border-t pt-4 ${r.divider}`}>
            <button
              onClick={() => handleExport('questions')}
              disabled={!selectedQuestionIds.size || exporting !== null}
              className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-50 ${r.btnNeon} ${r.btnText}`}
            >
              {exporting === 'questions' ? 'Hazırlanıyor...' : 'Sadece Soruları İndir'}
            </button>
            <button
              onClick={() => handleExport('answers')}
              disabled={!selectedQuestionIds.size || exporting !== null}
              className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-50 ${r.btnGhost} ${r.btnText}`}
            >
              {exporting === 'answers' ? 'Hazırlanıyor...' : 'Sadece Cevap Anahtarını İndir'}
            </button>
            <button
              onClick={() => handleExport('both')}
              disabled={!selectedQuestionIds.size || exporting !== null}
              className={`inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold disabled:opacity-50 ${r.btnGhost} ${r.btnText}`}
            >
              {exporting === 'both' ? 'Hazırlanıyor...' : 'İkisi Bir Arada İndir'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
