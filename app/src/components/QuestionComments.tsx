'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

type CommentRow = {
  id: number;
  parent_comment_id: number | null;
  student_id: string;
  body: string;
  status: 'pending' | 'published' | 'rejected';
  created_at: string;
};

// Bir test sorusuna yapılan yorumlar — sadece admin onayladıktan (status='published')
// sonra başkalarına görünür; öğrenci kendi yorumunu (onay beklerken bile) her zaman görür.
// Kopya çekmeyi kolaylaştırmasın diye sadece soru cevaplandıktan sonra gösteriliyor.
export default function QuestionComments({ questionId, isAnswered }: { questionId: number; isAnswered: boolean }) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAnswered) return;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from('question_comments')
        .select('id, parent_comment_id, student_id, body, status, created_at')
        .eq('question_id', questionId)
        .order('created_at', { ascending: true });
      setComments((data as CommentRow[] | null) || []);
      setLoading(false);
    })();
  }, [questionId, isAnswered]);

  async function submitComment(body: string, parentCommentId: number | null) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Yorum yapmak için giriş yapmalısın');
        return;
      }
      const { data, error: insertError } = await supabase
        .from('question_comments')
        .insert({ question_id: questionId, parent_comment_id: parentCommentId, student_id: user.id, body: trimmed })
        .select('id, parent_comment_id, student_id, body, status, created_at')
        .single();
      if (insertError) {
        setError('Yorum gönderilemedi, lütfen tekrar deneyin');
        return;
      }
      setComments((prev) => [...prev, data as CommentRow]);
      if (parentCommentId) {
        setReplyTo(null);
        setReplyText('');
      } else {
        setNewComment('');
      }
    } catch {
      setError('Yorum gönderilemedi, lütfen tekrar deneyin');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAnswered) return null;

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (id: number) => comments.filter((c) => c.parent_comment_id === id);

  return (
    <div className="mx-auto max-w-lg px-4 pb-8">
      <div className="rounded-2xl border border-default bg-surface-elevated p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-black text-default">Yorumlar</h3>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Yükleniyor…</p>
        ) : (
          <div className="space-y-3 mb-4">
            {topLevel.length === 0 && <p className="text-xs text-muted-foreground">Henüz yorum yok, ilk yorumu sen yaz.</p>}
            {topLevel.map((c) => (
              <div key={c.id} className="rounded-xl bg-surface px-3 py-2.5">
                <p className="text-sm text-default whitespace-pre-wrap">{c.body}</p>
                {c.status !== 'published' && c.student_id === userId && (
                  <p className="mt-1 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
                )}
                <button
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  className="mt-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-400"
                >
                  Yanıtla
                </button>

                {repliesOf(c.id).length > 0 && (
                  <div className="mt-2 ml-3 space-y-2 border-l-2 border-default pl-3">
                    {repliesOf(c.id).map((r) => (
                      <div key={r.id}>
                        <p className="text-sm text-default whitespace-pre-wrap">{r.body}</p>
                        {r.status !== 'published' && r.student_id === userId && (
                          <p className="mt-0.5 text-[11px] text-amber-500">Onay bekliyor, sadece sen görüyorsun.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {replyTo === c.id && (
                  <div className="mt-2 ml-3 flex gap-2">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                      placeholder="Yanıtını yaz…"
                      disabled={submitting}
                      className="flex-1 rounded-lg border border-default bg-surface px-2.5 py-1.5 text-xs text-default focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={() => submitComment(replyText, c.id)}
                      disabled={submitting || !replyText.trim()}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 disabled:opacity-40"
                    >
                      Gönder
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
            placeholder="Bu soru hakkında bir yorum yaz…"
            disabled={submitting}
            className="flex-1 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-default focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={() => submitComment(newComment, null)}
            disabled={submitting || !newComment.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500/25 disabled:opacity-40"
          >
            Gönder
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
