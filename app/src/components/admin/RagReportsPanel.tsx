'use client';

import React, { useEffect, useState } from 'react';

type RagAnswer = {
  id: number;
  question: string;
  answer: string;
  model: string;
  status: 'pending' | 'published' | 'rejected';
  grade_id: number;
  lesson_id: number;
  grades: { name: string } | { name: string }[] | null;
  lessons: { name: string } | { name: string }[] | null;
};

type ReportRow = {
  id: number;
  rag_answer_id: number;
  reason: string | null;
  status: 'open' | 'resolved';
  created_at: string;
  rag_answers: RagAnswer | RagAnswer[] | null;
};

function answerOf(row: ReportRow): RagAnswer | null {
  const a = row.rag_answers;
  return Array.isArray(a) ? a[0] || null : a;
}

function bookLabel(answer: RagAnswer): string {
  const grade = Array.isArray(answer.grades) ? answer.grades[0] : answer.grades;
  const lesson = Array.isArray(answer.lessons) ? answer.lessons[0] : answer.lessons;
  if (!grade && !lesson) return `Sınıf #${answer.grade_id} · Ders #${answer.lesson_id}`;
  return `${grade?.name || `Sınıf #${answer.grade_id}`} · ${lesson?.name || `Ders #${answer.lesson_id}`}`;
}

export default function RagReportsPanel() {
  const [items, setItems] = useState<ReportRow[]>([]);
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
      const res = await fetch('/api/admin/rag/reports?status=open');
      const data = await res.json();
      if (res.ok) setItems((data.items as ReportRow[] | null) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(reportId: number, action: 'unpublish' | 'dismiss') {
    setBusyId(reportId);
    try {
      const res = await fetch(`/api/admin/rag/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'İşlem başarısız');
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== reportId));
      showNotice('success', action === 'unpublish' ? 'Cevap yayından kaldırıldı' : 'Bildirim kapatıldı');
    } catch {
      showNotice('error', 'İşlem sırasında hata oluştu');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRegenerate(reportId: number, ragAnswerId: number) {
    setBusyId(reportId);
    try {
      const res = await fetch(`/api/admin/rag/qa/${ragAnswerId}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Yeniden üretilemedi');
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== reportId));
      showNotice('success', 'Cevap yeniden üretildi ve tekrar yayınlandı');
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
          <p className="text-gray-500 text-sm">Bekleyen bildirim yok 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => {
            const answer = answerOf(row);
            if (!answer) return null;
            return (
              <div key={row.id} className="bg-[#111114] rounded-2xl border border-white/5 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">{bookLabel(answer)}</span>
                  <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString('tr-TR')}</span>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Soru</p>
                  <p className="text-white text-sm">{answer.question}</p>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">AI Cevabı ({answer.model})</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{answer.answer}</p>
                </div>

                {row.reason && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-1">Öğrencinin bildirim notu</p>
                    <p className="text-amber-300 text-sm">{row.reason}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleAction(row.id, 'unpublish')}
                    disabled={busyId === row.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40"
                  >
                    Yayından Kaldır
                  </button>
                  <button
                    onClick={() => handleRegenerate(row.id, row.rag_answer_id)}
                    disabled={busyId === row.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
                  >
                    Tekrar AI&apos;ye Gönder
                  </button>
                  <button
                    onClick={() => handleAction(row.id, 'dismiss')}
                    disabled={busyId === row.id}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40"
                  >
                    Bildirimi Kapat (Sorun Yok)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
