'use client';

// Yazılı sayfasında admin'e soru düzenleme (2026-10-21) ve silme (2026-10-31). Sayfa ISR'da kalır; admin kontrolü
// tarayıcıda sayfa başına TEK sorgu (provider) — her soru düğmesi ayrı useIsAdmin çağırmasın. Kaydedince/silince
// API yazılı sayfalarını revalidate ediyor; router.refresh() güncel hâli getirir. Asıl yetki sunucuda.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { QuizQuestionEditModal } from '@/app/src/components/admin/QuizQuestionEditModal';

type AdminActions = { edit: (id: number) => void; remove: (id: number) => void };
const EditContext = createContext<AdminActions | null>(null);

export function YaziliAdminEditProvider({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [editId, setEditId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const flash = (ok: boolean, text: string) => {
    setStatus({ ok, text });
    setTimeout(() => setStatus(null), 4000);
  };

  const remove = async (id: number) => {
    // Soru silinince öğrencilerin yazılı denemelerindeki o soruya ait cevaplar da silinir (FK cascade).
    if (!window.confirm('Bu soru kalıcı olarak silinsin mi? Yazılı denemelerinde kullanıldıysa o cevaplar da silinir.')) return;
    const res = await fetch('/api/admin/manage/questions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    const data = (await res.json().catch(() => null)) as { failed?: { reason: string }[]; error?: string } | null;
    const failed = data?.failed?.[0];
    if (!res.ok || failed) {
      flash(false, failed?.reason || data?.error || 'Soru silinemedi');
      return;
    }
    router.refresh();
    flash(true, '✓ Soru silindi');
  };

  return (
    <EditContext.Provider value={isAdmin ? { edit: setEditId, remove: (id) => void remove(id) } : null}>
      {children}
      {editId !== null && (
        <QuizQuestionEditModal
          questionId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            router.refresh();
            flash(true, '✓ Soru kaydedildi');
          }}
        />
      )}
      {status && (
        <p role="status" className={`fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${status.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {status.text}
        </p>
      )}
    </EditContext.Provider>
  );
}

const iconBtn = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-elevated';

export function YaziliEditButton({ questionId }: { questionId: number }) {
  const actions = useContext(EditContext);
  if (!actions) return null;
  return (
    <span className="flex shrink-0">
      <button type="button" onClick={() => actions.edit(questionId)} aria-label="Soruyu düzenle" title="Soruyu düzenle (admin)" className={`${iconBtn} hover:text-indigo-500`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => actions.remove(questionId)} aria-label="Soruyu sil" title="Soruyu sil (admin)" className={`${iconBtn} hover:text-red-500`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </span>
  );
}
