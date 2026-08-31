'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, AlertTriangle, Flag } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MAX_QUESTION_LENGTH = 1000;

type Availability = 'loading' | 'available' | 'unavailable';
type AuthState = 'loading' | 'in' | 'out';
type ReportState = 'idle' | 'open' | 'sending' | 'sent';

type AnsweredQuestion = {
  id: number;
  question: string;
  answer: string;
  reportState: ReportState;
  reportReason: string;
};

export default function AskRagQuestionCard({
  gradeId,
  lessonId,
  lessonName,
}: {
  gradeId: number;
  lessonId: number;
  lessonName: string;
}) {
  const pathname = usePathname();
  const [availability, setAvailability] = useState<Availability>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rag/status?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json().catch(() => null);
      setAvailability(res.ok && data?.available ? 'available' : 'unavailable');
    })();
  }, [gradeId, lessonId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthState(user ? 'in' : 'out');
    });
  }, []);

  function updateAnswer(id: number, patch: Partial<AnsweredQuestion>) {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradeId, lessonId, question: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Sorunuz gönderilemedi, lütfen tekrar deneyin');
        return;
      }
      setAnswers((prev) => [
        { id: data.id, question: trimmed, answer: data.answer, reportState: 'idle', reportReason: '' },
        ...prev,
      ]);
      setQuestion('');
    } catch {
      setError('Sorunuz gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReport(item: AnsweredQuestion) {
    updateAnswer(item.id, { reportState: 'sending' });
    try {
      const res = await fetch('/api/rag/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragAnswerId: item.id, reason: item.reportReason }),
      });
      if (!res.ok) {
        updateAnswer(item.id, { reportState: 'open' });
        return;
      }
      updateAnswer(item.id, { reportState: 'sent' });
    } catch {
      updateAnswer(item.id, { reportState: 'open' });
    }
  }

  if (availability !== 'available') return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-6 sm:p-7 mb-7">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-semibold text-gray-900">{lessonName} Ders Notlarına Soru Sor</h2>
      </div>

      {authState === 'loading' ? null : authState === 'out' ? (
        <p className="text-sm text-gray-500">
          Soru sorabilmek için{' '}
          <a href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="text-indigo-600 font-medium hover:underline">
            giriş yapman
          </a>{' '}
          gerekiyor.
        </p>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
              placeholder="Bu dersin notlarıyla ilgili merak ettiğin bir şeyi sor…"
              rows={3}
              disabled={submitting}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-400">{question.length}/{MAX_QUESTION_LENGTH}</span>
              <button
                type="submit"
                disabled={submitting || !question.trim()}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Gönderiliyor…' : 'Soruyu Gönder'}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          {answers.length > 0 && (
            <div className="mt-5 space-y-4">
              {answers.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200/70 bg-gray-50/60 p-4">
                  <p className="text-sm font-medium text-gray-800 mb-1.5">{item.question}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>

                  <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-2.5 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Bu cevap yapay zeka tarafından üretildi, hata içerebilir.</span>
                  </div>

                  <div className="mt-2">
                    {item.reportState === 'idle' && (
                      <button
                        onClick={() => updateAnswer(item.id, { reportState: 'open' })}
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Flag className="h-3 w-3" /> Bu cevapta hata var, bildir
                      </button>
                    )}
                    {item.reportState === 'open' && (
                      <div className="space-y-2">
                        <textarea
                          value={item.reportReason}
                          onChange={(e) => updateAnswer(item.id, { reportReason: e.target.value.slice(0, 500) })}
                          placeholder="Neyin yanlış/eksik olduğunu kısaca yazabilirsin (opsiyonel)"
                          rows={2}
                          className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitReport(item)}
                            className="px-3 py-1 rounded-md bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                          >
                            Bildir
                          </button>
                          <button
                            onClick={() => updateAnswer(item.id, { reportState: 'idle', reportReason: '' })}
                            className="px-3 py-1 rounded-md text-gray-500 text-xs hover:bg-gray-100"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                    {item.reportState === 'sending' && <p className="text-xs text-gray-400">Gönderiliyor…</p>}
                    {item.reportState === 'sent' && <p className="text-xs text-emerald-600">Bildirdiğin için teşekkürler, incelenecek.</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
