// app/src/components/QuizModal.tsx
// Panelden açılan testler için overlay kabuğu (Next.js intercepting route'lar tarafından
// kullanılır — bkz. app/panel/@modal). Mobilde tam ekran, masaüstünde büyük ortalanmış panel.
// Kapatma (X / Escape / backdrop) her zaman router.back() ile önceki (panel) sayfaya döner —
// bu, QuizClient içindeki "Konuya/Üniteye Dön" linklerinden (gerçek sayfaya tam navigasyon)
// bilinçli olarak farklı bir "çıkış" anlamına gelir.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { emitQuizModalClosed } from '../lib/panelRefreshBridge';

export default function QuizModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const close = () => {
    // Panel sayfası bu slot'un altında mount'lu kalır (bkz. panel/layout.tsx) — router.back()
    // onu yeniden mount etmediği için, kapanışı panele haber vermek üzere ayrıca bir sinyal
    // yayınlıyoruz (bkz. panelRefreshBridge, kullanıcının "modal kapanınca otomatik güncellensin" isteği).
    emitQuizModalClosed();
    router.back();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={close}
    >
      <div
        className="relative h-full w-full bg-surface sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:rounded-2xl sm:border sm:border-default"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Kapat"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-default/70 border border-default hover:text-default transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="h-full overflow-y-auto px-4 pt-14 pb-8 sm:max-h-[90vh] sm:px-8">{children}</div>
      </div>
    </div>
  );
}
