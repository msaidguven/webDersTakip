'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MAX_QUESTION_LENGTH = 1000;

type Availability = 'loading' | 'available' | 'unavailable';
type AuthState = 'loading' | 'in' | 'out';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
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
      setSuccessMessage(data?.message || 'Sorunuz alındı. İnceleme sonrası yayınlanacak.');
      setQuestion('');
    } catch {
      setError('Sorunuz gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
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
          {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
