'use client';

import React, { useEffect, useState } from 'react';

type QaRow = {
  id: number;
  grade_id: number;
  lesson_id: number;
  question: string;
  answer: string;
  model: string;
  status: 'pending' | 'published' | 'rejected';
  created_at: string;
  grades: { name: string } | { name: string }[] | null;
  lessons: { name: string } | { name: string }[] | null;
};

function bookLabel(row: QaRow): string {
  const grade = Array.isArray(row.grades) ? row.grades[0] : row.grades;
  const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
  if (!grade && !lesson) return `Sınıf #${row.grade_id} · Ders #${row.lesson_id}`;
  return `${grade?.name || `Sınıf #${row.grade_id}`} · ${lesson?.name || `Ders #${row.lesson_id}`}`;
}

export default function RagQaApprovalPanel() {
  const [items, setItems] = useState<QaRow[]>([]);
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
      const res = await fetch('/api/admin/rag/qa?status=pending');
      const data = await res.json();
      if (res.ok) setItems((data.items as QaRow[] | null) || []);
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
      const res = await fetch(`/api/admin/rag/qa/${id}`, {
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
      showNotice('success', action === 'publish' ? 'Cevap yayınlandı' : 'Cevap reddedildi');
    } catch {
      showNotice('error', 'İşlem sırasında hata oluştu');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/rag/qa/${id}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Yeniden üretilemedi');
        return;
      }
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, answer: data.answer } : it)));
      showNotice('success', 'Cevap yeniden üretildi');
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
          <p className="text-gray-500 text-sm">Onay bekleyen soru-cevap yok 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div key={row.id} className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">{bookLabel(row)}</span>
                <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString('tr-TR')}</span>
              </div>

              <div className="mb-3">
                <p className="text-xs text-gray-500 mb-1">Soru</p>
                <p className="text-white text-sm">{row.question}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">AI Cevabı ({row.model})</p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{row.answer}</p>
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
                  onClick={() => handleRegenerate(row.id)}
                  disabled={busyId === row.id}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                >
                  Tekrar AI&apos;ye Gönder
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
