'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, AlertTriangle, Flag, Bot, MessageCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const MAX_LENGTH = 300;
const AI_TAG = '@ai';

type Availability = 'loading' | 'available' | 'unavailable';
type AuthState = 'loading' | 'in' | 'out';
type ReportState = 'idle' | 'open' | 'sending' | 'sent';

type Profile = { username: string | null; full_name: string | null; avatar_url: string | null } | null;

type CommentEntry = {
  kind: 'comment';
  id: number;
  parent_comment_id: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'deleted';
  created_at: string;
  student_id: string;
  profiles: Profile | Profile[];
};

type AiEntry = {
  kind: 'ai';
  id: number;
  question: string;
  answer: string;
  created_at: string;
  profiles: Profile | Profile[];
  reportState: ReportState;
  reportReason: string;
};

type FeedEntry = CommentEntry | AiEntry;

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

// Test sayfasında (quizQuestionId dolu) her şey sadece o soruya, ders sayfasında
// (quizQuestionId boş) sadece o üniteye özel: hem yorumlar hem AI soru-cevapları.
// Tek kutu, tek akış: öğrenci normal bir şey yazarsa yorum olur (admin onayı
// bekler), "@ai" yazarsa soru olarak Gemini'ye gider (otomatik yayınlanır) —
// X'teki "@grok" mantığı gibi, AI sadece çağrıldığında araya giriyor.
export default function UnitDiscussion({
  gradeId,
  lessonId,
  unitId,
  quizQuestionId,
  lessonName,
  questionContext,
  isAnswered = true,
}: {
  gradeId: number;
  lessonId: number;
  unitId: number;
  quizQuestionId?: number | null;
  lessonName: string;
  questionContext?: string | null;
  isAnswered?: boolean;
}) {
  const pathname = usePathname();
  const [availability, setAvailability] = useState<Availability>('loading');
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [aiEntries, setAiEntries] = useState<AiEntry[]>([]);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [commentBusyId, setCommentBusyId] = useState<number | null>(null);

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
      setUserId(user?.id ?? null);
    });
  }, []);

  const loadComments = React.useCallback(async () => {
    if (!isAnswered) return;
    const supabase = createClient();
    let query = supabase
      .from('question_comments')
      .select('id, parent_comment_id, body, status, created_at, student_id, profiles!question_comments_student_id_fkey(username, full_name, avatar_url)')
      .order('created_at', { ascending: true });
    query = quizQuestionId != null ? query.eq('question_id', quizQuestionId) : query.eq('unit_id', unitId);
    const { data } = await query;
    setComments(
      ((data as CommentEntry[] | null) || [])
        .filter((c) => c.status !== 'deleted')
        .map((c) => ({ ...c, kind: 'comment' as const }))
    );
  }, [unitId, quizQuestionId, isAnswered]);

  const loadAiFeed = React.useCallback(async () => {
    if (!isAnswered) return;
    const url = quizQuestionId != null ? `/api/rag/unit-feed?questionId=${quizQuestionId}` : `/api/rag/unit-feed?unitId=${unitId}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (res.ok && Array.isArray(data?.items)) {
      setAiEntries(
        data.items.map((it: { id: number; question: string; answer: string; created_at: string; profiles: Profile }) => ({
          ...it,
          kind: 'ai' as const,
          reportState: 'idle' as ReportState,
          reportReason: '',
        }))
      );
    }
  }, [unitId, quizQuestionId, isAnswered]);

  useEffect(() => {
    loadComments();
    loadAiFeed();
  }, [loadComments, loadAiFeed]);

  function updateAiEntry(id: number, patch: Partial<AiEntry>) {
    setAiEntries((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function submitComment(body: string, parentCommentId: number | null) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Bunun için giriş yapmalısın');
        return;
      }
      const insertRow: Record<string, unknown> = { student_id: user.id, body: trimmed, parent_comment_id: parentCommentId };
      if (quizQuestionId != null) insertRow.question_id = quizQuestionId;
      else insertRow.unit_id = unitId;

      const { data, error: insertError } = await supabase
        .from('question_comments')
        .insert(insertRow)
        .select('id, parent_comment_id, body, status, created_at, student_id')
        .single();
      if (insertError) {
        setError('Gönderilemedi, lütfen tekrar deneyin');
        return;
      }
      setComments((prev) => [...prev, { ...(data as CommentEntry), kind: 'comment' }]);
      if (parentCommentId) {
        setReplyTo(null);
        setReplyText('');
      } else {
        setText('');
      }
    } catch {
      setError('Gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteComment(comment: CommentEntry) {
    if (!window.confirm('Bu yorumu silmek istediğine emin misin? Yanıtı varsa onlar da kaldırılır.')) return;
    setCommentBusyId(comment.id);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Silinemedi');
        return;
      }
      // Üst yorumsa yanıtları da kaldı — sadeliği korumak için akışı yeniden yüklüyoruz.
      if (comment.parent_comment_id == null) {
        await loadComments();
      } else {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      }
    } catch {
      setError('Silinemedi, lütfen tekrar deneyin');
    } finally {
      setCommentBusyId(null);
    }
  }

  function startEdit(comment: CommentEntry) {
    setEditingId(comment.id);
    setEditText(comment.body);
  }

  async function saveEdit(comment: CommentEntry) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setCommentBusyId(comment.id);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', body: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Düzenlenemedi');
        return;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, body: trimmed, status: data.status || c.status } : c))
      );
      setEditingId(null);
      setEditText('');
    } catch {
      setError('Düzenlenemedi, lütfen tekrar deneyin');
    } finally {
      setCommentBusyId(null);
    }
  }

  async function submitAiQuestion(raw: string) {
    const question = raw.replace(new RegExp(AI_TAG, 'gi'), '').trim() || raw.trim();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeId,
          lessonId,
          unitId,
          quizQuestionId: quizQuestionId ?? undefined,
          question,
          questionContext: questionContext || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Sorunuz gönderilemedi, lütfen tekrar deneyin');
        if (res.status === 429) setDailyRemaining(0);
        return;
      }
      setAiEntries((prev) => [
        {
          id: data.id,
          question,
          answer: data.answer,
          created_at: new Date().toISOString(),
          profiles: data.profile || null,
          kind: 'ai',
          reportState: 'idle',
          reportReason: '',
        },
        ...prev,
      ]);
      setText('');
      if (typeof data.remaining === 'number') setDailyRemaining(data.remaining);
    } catch {
      setError('Sorunuz gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    if (trimmed.toLowerCase().includes(AI_TAG)) {
      if (availability !== 'available') {
        setError('Bu ders için henüz ders notu eklenmedi, @ai ile soru sorulamıyor — yine de yorum yapabilirsin.');
        return;
      }
      if (dailyRemaining === 0) {
        setError('Bugünkü AI soru hakkını doldurdun. Yarın tekrar sorabilirsin.');
        return;
      }
      await submitAiQuestion(trimmed);
    } else {
      await submitComment(trimmed, null);
    }
  }

  async function submitReport(item: AiEntry) {
    updateAiEntry(item.id, { reportState: 'sending' });
    try {
      const res = await fetch('/api/rag/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ragAnswerId: item.id, reason: item.reportReason }),
      });
      if (!res.ok) {
        updateAiEntry(item.id, { reportState: 'open' });
        return;
      }
      updateAiEntry(item.id, { reportState: 'sent' });
    } catch {
      updateAiEntry(item.id, { reportState: 'open' });
    }
  }

  if (!isAnswered) return null;
  if (availability === 'loading') return null;

  const topLevelComments = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (id: number) => comments.filter((c) => c.parent_comment_id === id);

  const feed: FeedEntry[] = [...topLevelComments, ...aiEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm p-6 sm:p-7 mb-7">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-semibold text-gray-900">{quizQuestionId != null ? 'Bu Soru Hakkında' : `${lessonName} Hakkında`}</h2>
      </div>

      {authState === 'loading' ? null : authState === 'out' ? (
        <p className="text-sm text-gray-500">
          Yorum yapmak veya AI&apos;ye soru sormak için{' '}
          <a href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="text-indigo-600 font-medium hover:underline">
            giriş yapman
          </a>{' '}
          gerekiyor.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Yorum yaz, ya da @ai yazarak ders notlarına soru sor…"
            rows={3}
            disabled={submitting}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 disabled:opacity-60 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {text.length}/{MAX_LENGTH}
              {dailyRemaining != null && ` · @ai için bugün kalan hakkın: ${dailyRemaining}`}
            </span>
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {feed.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          {feed.map((item) => {
            if (item.kind === 'comment') {
              const name = displayNameOf(item.profiles);
              const isOwn = item.student_id === userId;
              const isEditing = editingId === item.id;
              const isBusy = commentBusyId === item.id;
              return (
                <div key={`c${item.id}`} className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={name} url={avatarUrlOf(item.profiles)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{name}</span>
                        <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                      </div>

                      {isEditing ? (
                        <div className="mt-1 space-y-1.5">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value.slice(0, MAX_LENGTH))}
                            rows={2}
                            disabled={isBusy}
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(item)}
                              disabled={isBusy || !editText.trim()}
                              className="px-3 py-1 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditText('');
                              }}
                              className="px-3 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100"
                            >
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{item.body}</p>
                      )}

                      {item.status !== 'published' && item.status !== 'deleted' && isOwn && (
                        <p className="mt-1 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
                      )}

                      {!isEditing && (
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            onClick={() => setReplyTo(replyTo === item.id ? null : item.id)}
                            className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
                          >
                            Yanıtla
                          </button>
                          {isOwn && (
                            <>
                              <button
                                onClick={() => startEdit(item)}
                                disabled={isBusy}
                                className="text-[11px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40"
                              >
                                Düzenle
                              </button>
                              <button
                                onClick={() => handleDeleteComment(item)}
                                disabled={isBusy}
                                className="text-[11px] font-bold text-red-400 hover:text-red-600 disabled:opacity-40"
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {repliesOf(item.id).length > 0 && (
                        <div className="mt-2 ml-1 space-y-2 border-l-2 border-gray-100 pl-3">
                          {repliesOf(item.id).map((r) => {
                            const rIsOwn = r.student_id === userId;
                            const rIsEditing = editingId === r.id;
                            const rIsBusy = commentBusyId === r.id;
                            return (
                              <div key={r.id}>
                                {rIsEditing ? (
                                  <div className="space-y-1.5">
                                    <textarea
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value.slice(0, MAX_LENGTH))}
                                      rows={2}
                                      disabled={rIsBusy}
                                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveEdit(r)}
                                        disabled={rIsBusy || !editText.trim()}
                                        className="px-3 py-1 rounded-md text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
                                      >
                                        Kaydet
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingId(null);
                                          setEditText('');
                                        }}
                                        className="px-3 py-1 rounded-md text-xs text-gray-500 hover:bg-gray-100"
                                      >
                                        Vazgeç
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.body}</p>
                                )}
                                {r.status !== 'published' && r.status !== 'deleted' && rIsOwn && (
                                  <p className="mt-0.5 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
                                )}
                                {!rIsEditing && rIsOwn && (
                                  <div className="mt-0.5 flex items-center gap-3">
                                    <button
                                      onClick={() => startEdit(r)}
                                      disabled={rIsBusy}
                                      className="text-[11px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40"
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      onClick={() => handleDeleteComment(r)}
                                      disabled={rIsBusy}
                                      className="text-[11px] font-bold text-red-400 hover:text-red-600 disabled:opacity-40"
                                    >
                                      Sil
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {replyTo === item.id && (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value.slice(0, MAX_LENGTH))}
                            placeholder="Yanıtını yaz…"
                            disabled={submitting}
                            className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <button
                            onClick={() => submitComment(replyText, item.id)}
                            disabled={submitting || !replyText.trim()}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-600 hover:bg-indigo-500/25 disabled:opacity-40"
                          >
                            Gönder
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const name = displayNameOf(item.profiles);
            return (
              <div key={`a${item.id}`} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <Avatar name={name} url={avatarUrlOf(item.profiles)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{name}</span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                    <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{AI_TAG} {item.question}</p>
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
                          onClick={() => updateAiEntry(item.id, { reportState: 'open' })}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Flag className="h-3 w-3" /> Bu cevapta hata var, bildir
                        </button>
                      )}
                      {item.reportState === 'open' && (
                        <div className="space-y-2">
                          <textarea
                            value={item.reportReason}
                            onChange={(e) => updateAiEntry(item.id, { reportReason: e.target.value.slice(0, 500) })}
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
                              onClick={() => updateAiEntry(item.id, { reportState: 'idle', reportReason: '' })}
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

      {feed.length === 0 && authState !== 'loading' && (
        <p className="mt-5 text-sm text-gray-400 border-t border-gray-100 pt-5">
          {quizQuestionId != null ? 'Bu soru için henüz yorum yok, ilk yorumu sen yaz.' : 'Henüz yorum yok, ilk yorumu sen yaz.'}
        </p>
      )}

      {questionContext && (
        <p className="mt-3 text-xs text-gray-400">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Sadece bu soru hakkında AI&apos;ye sormak için <span className="font-mono">{AI_TAG}</span> yaz — örn. &quot;{AI_TAG} neden A doğru?&quot;
        </p>
      )}
    </div>
  );
}
