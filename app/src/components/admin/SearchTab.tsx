'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { QuestionEditModal } from '@/app/src/components/admin/ManagementTab';

type TopicRef = { title: string } | { title: string }[] | null;
type TypeRef = { code: string } | { code: string }[] | null;

function firstOf<T extends { title?: string; code?: string }>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] || null : v;
}

type QuestionResult = {
  id: number;
  question_text: string;
  solution_text: string | null;
  topic_id: number | null;
  topics: TopicRef;
  question_types: TypeRef;
};

type ContentResult = {
  id: number;
  title: string;
  subtitle: string | null;
  is_published: boolean;
  topic_id: number | null;
  topicTitle: string | null;
  href: string | null;
};

type ResultBucket<T> = { items: T[]; total: number; truncated: boolean };
const EMPTY_BUCKET = { items: [], total: 0, truncated: false };

type Scope = 'all' | 'questions' | 'contents';
type LookupRow = { id: number; label: string };

const SCOPE_OPTIONS: { key: Scope; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'questions', label: '❓ Sorularda Ara' },
  { key: 'contents', label: '📝 İçeriklerde Ara' },
];

export default function SearchTab() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [gradeId, setGradeId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | null>(null);

  const [grades, setGrades] = useState<LookupRow[]>([]);
  const [lessons, setLessons] = useState<LookupRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<ResultBucket<QuestionResult>>(EMPTY_BUCKET);
  const [contents, setContents] = useState<ResultBucket<ContentResult>>(EMPTY_BUCKET);

  const [editQuestionId, setEditQuestionId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: gradesData } = await supabase.from('grades').select('id, name').order('order_no');
      setGrades(((gradesData as { id: number; name: string }[] | null) || []).map((g) => ({ id: g.id, label: g.name })));

      const { data: lessonsData } = await supabase.from('lessons').select('id, name').order('order_no');
      setLessons(((lessonsData as { id: number; name: string }[] | null) || []).map((l) => ({ id: l.id, label: l.name })));
    })();
  }, []);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }

  async function performSearch(term: string, opts: { scope: Scope; gradeId: string; lessonId: string; page: number }) {
    if (term.trim().length < 2) {
      setError('En az 2 karakter girin');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: term.trim(), scope: opts.scope, page: String(opts.page) });
      if (opts.gradeId) params.set('gradeId', opts.gradeId);
      if (opts.lessonId) params.set('lessonId', opts.lessonId);
      const res = await fetch(`/api/admin/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Arama başarısız');
        setQuestions(EMPTY_BUCKET);
        setContents(EMPTY_BUCKET);
        return;
      }
      setQuestions(data.questions);
      setContents(data.contents);
      setPageSize(data.pageSize);
    } catch {
      setError('Arama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit() {
    setQuery(input);
    setPage(1);
    performSearch(input, { scope, gradeId, lessonId, page: 1 });
  }

  function handleScopeChange(next: Scope) {
    setScope(next);
    setPage(1);
    if (query) performSearch(query, { scope: next, gradeId, lessonId, page: 1 });
  }

  function handleGradeChange(v: string) {
    setGradeId(v);
    setPage(1);
    if (query) performSearch(query, { scope, gradeId: v, lessonId, page: 1 });
  }

  function handleLessonChange(v: string) {
    setLessonId(v);
    setPage(1);
    if (query) performSearch(query, { scope, gradeId, lessonId: v, page: 1 });
  }

  function handlePageChange(next: number) {
    setPage(next);
    performSearch(query, { scope, gradeId, lessonId, page: next });
  }

  function handleSeeAll(target: Scope) {
    setScope(target);
    setPage(1);
    performSearch(query, { scope: target, gradeId, lessonId, page: 1 });
  }

  const totalResults = questions.total + contents.total;

  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
          placeholder="Soru veya içerik metni ara..."
          autoFocus
          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSearchSubmit}
          className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white text-sm font-medium whitespace-nowrap"
        >
          🔎 Ara
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111114] rounded-xl border border-white/5 p-3 sm:p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-gray-400 text-xs">Kapsam</label>
          <div className="flex gap-1.5">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => handleScopeChange(o.key)}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  scope === o.key ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <SimpleSelect label="Sınıf" value={gradeId} onChange={handleGradeChange} options={grades} />
        <SimpleSelect label="Ders" value={lessonId} onChange={handleLessonChange} options={lessons} />
      </div>

      {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Aranıyor...</p>}

      {!loading && searched && !error && (
        <p className="text-gray-500 text-xs mb-4">&quot;{query}&quot; için {totalResults} sonuç bulundu</p>
      )}

      {!loading && scope !== 'contents' && questions.items.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              ❓ Sorular <span className="text-gray-500 text-xs font-normal">({questions.total}{questions.truncated ? '+' : ''})</span>
            </h3>
            {scope === 'all' && questions.total > questions.items.length && (
              <button onClick={() => handleSeeAll('questions')} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">
                Tümünü Gör →
              </button>
            )}
          </div>
          <div className="space-y-2">
            {questions.items.map((q) => {
              const topic = firstOf(q.topics);
              const type = firstOf(q.question_types);
              return (
                <div key={q.id} className="bg-[#111114] rounded-xl border border-white/5 p-4 flex items-start justify-between gap-3 hover:border-white/10 transition-all">
                  <div className="min-w-0">
                    <p className="text-gray-200 text-sm line-clamp-2">{q.question_text}</p>
                    <p className="text-gray-500 text-xs mt-1">{[topic?.title, type?.code].filter(Boolean).join(' • ')}</p>
                  </div>
                  <button
                    onClick={() => setEditQuestionId(q.id)}
                    className="shrink-0 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs"
                  >
                    Düzenle
                  </button>
                </div>
              );
            })}
          </div>
          {scope === 'questions' && pageSize && (
            <Pagination page={page} pageSize={pageSize} total={questions.total} onChange={handlePageChange} />
          )}
        </section>
      )}

      {!loading && scope !== 'questions' && contents.items.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              📝 İçerikler <span className="text-gray-500 text-xs font-normal">({contents.total}{contents.truncated ? '+' : ''})</span>
            </h3>
            {scope === 'all' && contents.total > contents.items.length && (
              <button onClick={() => handleSeeAll('contents')} className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">
                Tümünü Gör →
              </button>
            )}
          </div>
          <div className="space-y-2">
            {contents.items.map((c) => (
              <div key={c.id} className="bg-[#111114] rounded-xl border border-white/5 p-4 flex items-start justify-between gap-3 hover:border-white/10 transition-all">
                <div className="min-w-0">
                  <p className="text-gray-200 text-sm line-clamp-2">{c.title}</p>
                  <p className="text-gray-500 text-xs mt-1">{[c.topicTitle, c.is_published ? 'Yayında' : 'Taslak'].filter(Boolean).join(' • ')}</p>
                </div>
                {c.href ? (
                  <Link
                    href={c.href}
                    target="_blank"
                    className="shrink-0 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs whitespace-nowrap"
                  >
                    Ders Sayfasına Git ↗
                  </Link>
                ) : (
                  <span className="shrink-0 px-3 py-1.5 bg-white/5 text-gray-500 rounded-lg text-xs whitespace-nowrap cursor-not-allowed" title="Konu/ünite/ders/sınıf slug'ı eksik olduğu için sayfa linki oluşturulamadı">
                    Link yok
                  </span>
                )}
              </div>
            ))}
          </div>
          {scope === 'contents' && pageSize && (
            <Pagination page={page} pageSize={pageSize} total={contents.total} onChange={handlePageChange} />
          )}
        </section>
      )}

      {!loading && searched && !error && totalResults === 0 && (
        <div className="bg-[#111114] rounded-xl border border-white/5 p-8 sm:p-12 text-center">
          <p className="text-gray-400 text-sm">Sonuç bulunamadı</p>
        </div>
      )}

      {editQuestionId != null && (
        <QuestionEditModal
          questionId={editQuestionId}
          onClose={() => setEditQuestionId(null)}
          onSaved={() => {
            setEditQuestionId(null);
            showNotice('success', 'Soru kaydedildi');
          }}
          showNotice={showNotice}
        />
      )}
    </div>
  );
}

function SimpleSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: LookupRow[] }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-gray-400 text-xs">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-36 sm:w-44"
      >
        <option value="">Tümü</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs sm:text-sm hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Önceki
      </button>
      <span className="text-gray-500 text-xs">
        Sayfa {page} / {totalPages} • {total} sonuç
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs sm:text-sm hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Sonraki →
      </button>
    </div>
  );
}
