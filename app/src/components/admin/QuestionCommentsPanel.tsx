'use client';

import React, { useEffect, useState } from 'react';

type CommentRow = {
  id: number;
  question_id: number | null;
  unit_id: number | null;
  parent_comment_id: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected';
  created_at: string;
  parent_body: string | null;
  questions: { question_text: string } | { question_text: string }[] | null;
  units: { title: string } | { title: string }[] | null;
};

function contextLabelOf(row: CommentRow): string {
  if (row.question_id != null) {
    const q = row.questions;
    const single = Array.isArray(q) ? q[0] : q;
    return single?.question_text || `Soru #${row.question_id}`;
  }
  const u = row.units;
  const single = Array.isArray(u) ? u[0] : u;
  return single?.title ? `Ünite: ${single.title}` : `Ünite #${row.unit_id}`;
}

export default function QuestionCommentsPanel() {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 6000);
  }

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/question-comments?status=pending');
      const data = await res.json();
      if (res.ok) setItems((data.items as CommentRow[] | null) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(id: number, action: 'publish' | 'reject') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/question-comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'İşlem başarısız');
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      showNotice('success', action === 'publish' ? 'Yorum yayınlandı' : 'Yorum reddedildi');
    } catch {
      showNotice('error', 'İşlem sırasında hata oluştu');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm ${notice.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="bg-[#111114] rounded-2xl border border-white/5 p-8 text-center">
          <p className="text-gray-500 text-sm">Onay bekleyen yorum yok 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div key={row.id} className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                  {row.parent_comment_id ? 'Yanıt' : 'Yorum'}
                </span>
                <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString('tr-TR')}</span>
              </div>

              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">{row.question_id != null ? 'Soru' : 'Bağlam'}</p>
                <p className="text-white text-sm">{contextLabelOf(row)}</p>
              </div>

              {row.parent_body && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Yanıtlanan yorum</p>
                  <p className="text-gray-400 text-sm">{row.parent_body}</p>
                </div>
              )}

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">{row.parent_comment_id ? 'Yanıt' : 'Yorum'}</p>
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{row.body}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction(row.id, 'publish')}
                  disabled={busyId === row.id}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  Yayınla
                </button>
                <button
                  onClick={() => handleAction(row.id, 'reject')}
                  disabled={busyId === row.id}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
