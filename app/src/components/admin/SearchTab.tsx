'use client';

import React, { useState } from 'react';
import { ENTITIES, GenericEditModal, QuestionEditModal } from '@/app/src/components/admin/ManagementTab';

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
  body_markdown: string | null;
  is_published: boolean;
  topic_id: number | null;
  topics: TopicRef;
};

const contentsEntity = ENTITIES.find((e) => e.key === 'contents')!;

export default function SearchTab() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [contents, setContents] = useState<ContentResult[]>([]);

  const [editQuestionId, setEditQuestionId] = useState<number | null>(null);
  const [editContentRow, setEditContentRow] = useState<ContentResult | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 5000);
  }

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setError('En az 2 karakter girin');
      return;
    }
    setError('');
    setLoading(true);
    setSearched(true);
    setQuery(trimmed);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Arama başarısız');
        setQuestions([]);
        setContents([]);
        return;
      }
      setQuestions(data.questions || []);
      setContents(data.contents || []);
    } catch {
      setError('Arama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  const totalResults = questions.length + contents.length;

  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(input)}
          placeholder="Soru veya içerik metni ara..."
          autoFocus
          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => runSearch(input)}
          className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white text-sm font-medium whitespace-nowrap"
        >
          🔎 Ara
        </button>
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

      {!loading && questions.length > 0 && (
        <section className="mb-8">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            ❓ Sorular <span className="text-gray-500 text-xs font-normal">({questions.length})</span>
          </h3>
          <div className="space-y-2">
            {questions.map((q) => {
              const topic = firstOf(q.topics);
              const type = firstOf(q.question_types);
              return (
                <ResultRow
                  key={q.id}
                  title={q.question_text}
                  meta={[topic?.title, type?.code].filter(Boolean).join(' • ')}
                  onEdit={() => setEditQuestionId(q.id)}
                />
              );
            })}
          </div>
        </section>
      )}

      {!loading && contents.length > 0 && (
        <section className="mb-8">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            📝 İçerikler <span className="text-gray-500 text-xs font-normal">({contents.length})</span>
          </h3>
          <div className="space-y-2">
            {contents.map((c) => {
              const topic = firstOf(c.topics);
              return (
                <ResultRow
                  key={c.id}
                  title={c.title}
                  meta={[topic?.title, c.is_published ? 'Yayında' : 'Taslak'].filter(Boolean).join(' • ')}
                  onEdit={() => setEditContentRow(c)}
                />
              );
            })}
          </div>
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
      {editContentRow && (
        <GenericEditModal
          entity={contentsEntity}
          row={editContentRow}
          onClose={() => setEditContentRow(null)}
          onSaved={() => {
            setEditContentRow(null);
            showNotice('success', 'İçerik kaydedildi');
          }}
          showNotice={showNotice}
        />
      )}
    </div>
  );
}

function ResultRow({ title, meta, onEdit }: { title: string; meta: string; onEdit: () => void }) {
  return (
    <div className="bg-[#111114] rounded-xl border border-white/5 p-4 flex items-start justify-between gap-3 hover:border-white/10 transition-all">
      <div className="min-w-0">
        <p className="text-gray-200 text-sm line-clamp-2">{title}</p>
        {meta && <p className="text-gray-500 text-xs mt-1">{meta}</p>}
      </div>
      <button onClick={onEdit} className="shrink-0 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs">
        Düzenle
      </button>
    </div>
  );
}
