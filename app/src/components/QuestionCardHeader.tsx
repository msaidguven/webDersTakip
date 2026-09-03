'use client';

// /soru-bankasi sayfasındaki her soru kartının üst satırı: tip rozeti + paylaş butonu +
// (admin ise) düzenle/sil butonları. Canlı test akışındaki (QuizClient.tsx içindeki
// handleShare/handleAdminDelete/QuizQuestionEditModal kullanımı) ile birebir aynı davranış —
// buraya, tek seferde bir soru değil aynı anda 20-70 soru kartı render edildiği için (her
// kartın kendi paylaş/silme durumu olması gerektiğinden) ayrı bir component olarak taşındı.
import { useState } from 'react';
import { Pencil, Share2, Trash2 } from 'lucide-react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import { TYPE_LABELS } from '@/app/src/components/QuizClient';
import { QuizQuestionEditModal } from '@/app/src/components/admin/QuizQuestionEditModal';

function shareTextFor(q: QuizQuestion): string {
  if (q.type === 'matching') return 'Bu eşleştirme sorusuna bir bak!';
  return q.question_text;
}

export default function QuestionCardHeader({
  question: q,
  isAdmin,
  basePath,
  onDeleted,
}: {
  question: QuizQuestion;
  isAdmin: boolean;
  basePath: string;
  onDeleted: (questionId: number) => void;
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}${basePath}?soru=${q.id}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Ders Takip - Soru', text: shareTextFor(q), url });
      } catch {
        // kullanıcı paylaşım penceresini iptal etti — sessizce geç
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Clipboard API yoksa (çok eski tarayıcı) sessizce yok say
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/admin/manage/questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [q.id] }),
      });
      if (!res.ok) {
        setDeleteError('Silinemedi, lütfen tekrar dene.');
        return;
      }
      setConfirmDeleteOpen(false);
      onDeleted(q.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <span className="inline-block rounded-full bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
          {TYPE_LABELS[q.type]}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Soruyu paylaş"
            title="Soruyu paylaş"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-indigo-500"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Soruyu düzenle"
                title="Soruyu düzenle"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/10 hover:text-indigo-500"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label="Soruyu sil"
                title="Soruyu sil"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {shareState === 'copied' && <p className="mb-2 text-xs font-bold text-emerald-500">Bağlantı kopyalandı!</p>}
      {editSaved && <p className="mb-2 text-xs font-bold text-emerald-500">Kaydedildi — güncel hâli sayfa yenilenince görünür.</p>}

      {editOpen && (
        <QuizQuestionEditModal
          questionId={q.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            setEditSaved(true);
            setTimeout(() => setEditSaved(false), 4000);
          }}
        />
      )}

      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-default bg-surface-elevated p-5">
            <h3 className="text-base font-black text-default">Bu soru silinsin mi?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>
            {deleteError && <p className="mt-2 text-xs font-bold text-rose-500">{deleteError}</p>}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-default bg-surface px-4 py-2.5 text-sm font-black text-default disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {deleting ? 'Siliniyor...' : 'Sil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
