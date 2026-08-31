'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, AlertTriangle, Flag, Bot } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MAX_QUESTION_LENGTH = 300;

type Availability = 'loading' | 'available' | 'unavailable';
type AuthState = 'loading' | 'in' | 'out';
type ReportState = 'idle' | 'open' | 'sending' | 'sent';

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null } | null;

type FeedItem = {
  id: number;
  question: string;
  answer: string;
  created_at: string;
  profiles: Profile | Profile[];
  reportState: ReportState;
  reportReason: string;
};

function displayNameOf(profiles: Profile | Profile[]): string {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.username || p?.full_name || 'Öğrenci';
}

function avatarUrlOf(profiles: Profile | Profile[]): string | null {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p?.avatar_url || null;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function AskRagQuestionCard({
  gradeId,
  lessonId,
  unitId,
  lessonName,
  questionContext,
}: {
  gradeId: number;
  lessonId: number;
  // Bir ünitede sorulan sorular sadece o ünitenin akışında görünsün diye — akış
  // (unit-feed) bununla filtreleniyor. Arama (retrieval) hâlâ tüm kitap kapsamında.
  unitId: number;
  lessonName: string;
  // Test sayfasında kullanıldığında aktif sorunun (kökü + şıklar + doğru cevap) düz
  // metin özeti — öğrenci soruyu kopyalamadan "neden A" gibi kısa bir şey yazabilsin.
  questionContext?: string | null;
}) {
  const pathname = usePathname();
  const [availability, setAvailability] = useState<Availability>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rag/status?gradeId=${gradeId}&lessonId=${lessonId}`);
      const data = await res.json().catch(() => null);
      setAvailability(res.ok && data?.available ? 'available' : 'unavailable');
      if (res.ok && typeof data?.dailyRemaining === 'number') setDailyRemaining(data.dailyRemaining);
    })();
  }, [gradeId, lessonId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthState(user ? 'in' : 'out');
    });
  }, []);

  // Bu ünitede sorulup yayınlanmış TÜM soru-cevaplar — herkese açık, tıpkı üniteye
  // yapılmış yorumlar gibi (kimin sorduğu değil, ne sorulduğu önemli).
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/rag/unit-feed?unitId=${unitId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.items)) {
        setFeed(
          data.items.map((it: { id: number; question: string; answer: string; created_at: string; profiles: Profile }) => ({
            ...it,
            reportState: 'idle' as ReportState,
            reportReason: '',
          }))
        );
      }
    })();
  }, [unitId]);

  function updateFeedItem(id: number, patch: Partial<FeedItem>) {
    setFeed((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
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
        body: JSON.stringify({ gradeId, lessonId, unitId, question: trimmed, questionContext: questionContext || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Sorunuz gönderilemedi, lütfen tekrar deneyin');
        if (res.status === 429) setDailyRemaining(0);
        return;
      }
      setFeed((prev) => [
        {
          id: data.id,
          question: trimmed,
          answer: data.answer,
          created_at: new Date().toISOString(),
          profiles: data.profile || null,
          reportState: 'idle',
          reportReason: '',
        },
        ...prev,
      ]);
      setQuestion('');
      if (typeof data.remaining === 'number') setDailyRemaining(data.remaining);
    } catch {
      setError('Sorunuz gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReport(item: FeedItem) {
    updateFeedItem(item.id, { reportState: 'sending' });
    try {
      const res = await fetch('/api/rag/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragAnswerId: item.id, reason: item.reportReason }),
      });
      if (!res.ok) {
        updateFeedItem(item.id, { reportState: 'open' });
        return;
      }
      updateFeedItem(item.id, { reportState: 'sent' });
    } catch {
      updateFeedItem(item.id, { reportState: 'open' });
    }
  }

  if (availability !== 'available') return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-6 sm:p-7 mb-7">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-semibold text-gray-900">
          {questionContext ? 'Bu Soruyu Anlamadın mı?' : `${lessonName} Ders Notlarına Soru Sor`}
        </h2>
      </div>

      {authState === 'loading' ? null : authState === 'out' ? (
        <p className="text-sm text-gray-500">
          Soru sorabilmek için{' '}
          <a href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="text-indigo-600 font-medium hover:underline">
            giriş yapman
          </a>{' '}
          gerekiyor.
        </p>
      ) : dailyRemaining === 0 ? (
        <p className="text-sm text-gray-500">Bugünkü soru hakkını doldurdun. Yarın tekrar sorabilirsin.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
            placeholder={questionContext ? 'Örn: neden A doğru?' : 'Bu dersin notlarıyla ilgili merak ettiğin bir şeyi sor…'}
            rows={3}
            disabled={submitting}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {question.length}/{MAX_QUESTION_LENGTH}
              {dailyRemaining != null && ` · Bugün kalan hakkın: ${dailyRemaining}`}
            </span>
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
      )}

      {feed.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          {feed.map((item) => {
            const name = displayNameOf(item.profiles);
            return (
              <div key={item.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <Avatar name={name} url={avatarUrlOf(item.profiles)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{name}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{item.question}</p>
                  </div>
                </div>

                <div className="ml-[42px] flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg bg-gray-50/80 p-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded-md px-2.5 py-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Bu cevap yapay zeka tarafından üretildi, hata içerebilir.</span>
                    </div>

                    <div className="mt-2">
                      {item.reportState === 'idle' && (
                        <button
                          onClick={() => updateFeedItem(item.id, { reportState: 'open' })}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Flag className="h-3 w-3" /> Bu cevapta hata var, bildir
                        </button>
                      )}
                      {item.reportState === 'open' && (
                        <div className="space-y-2">
                          <textarea
                            value={item.reportReason}
                            onChange={(e) => updateFeedItem(item.id, { reportReason: e.target.value.slice(0, 500) })}
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
                              onClick={() => updateFeedItem(item.id, { reportState: 'idle', reportReason: '' })}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
