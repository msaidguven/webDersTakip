'use client';

// Yazılı sayfasında admin'e soru düzenleme (2026-10-21). Sayfa ISR'da kalır; admin kontrolü tarayıcıda
// sayfa başına TEK sorgu (provider) — her soru düğmesi ayrı useIsAdmin çağırmasın. Kaydedince API
// yazılı sayfalarını revalidate ediyor; router.refresh() güncel hâli getirir. Asıl yetki sunucuda.
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { QuizQuestionEditModal } from '@/app/src/components/admin/QuizQuestionEditModal';

const EditContext = createContext<((id: number) => void) | null>(null);

export function YaziliAdminEditProvider({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [editId, setEditId] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <EditContext.Provider value={isAdmin ? setEditId : null}>
      {children}
      {editId !== null && (
        <QuizQuestionEditModal
          questionId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            setSaved(true);
            router.refresh();
            setTimeout(() => setSaved(false), 4000);
          }}
        />
      )}
      {saved && (
        <p role="status" className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          ✓ Soru kaydedildi
        </p>
      )}
    </EditContext.Provider>
  );
}

export function YaziliEditButton({ questionId }: { questionId: number }) {
  const openEdit = useContext(EditContext);
  if (!openEdit) return null;
  return (
    <button
      type="button"
      onClick={() => openEdit(questionId)}
      aria-label="Soruyu düzenle"
      title="Soruyu düzenle (admin)"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-indigo-500"
    >
      <Pencil className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
