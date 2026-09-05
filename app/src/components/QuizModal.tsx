// app/src/components/QuizModal.tsx
// Overlay kabuğu — iki farklı açılış şekli kullanıyor:
//   1) Intercepting route'lar (bkz. app/panel/@modal, app/soru-bankasi/@modal): gerçek bir
//      route navigasyonuyla açılır, kapatma router.back() ile önceki sayfaya döner.
//   2) Soru bankasının kendi client-side modalı (bkz. TestStatusCard.tsx, kullanıcının
//      2026-09-05 isteği: "URL hiç değişmesin"): hiçbir navigasyon olmadan, saf React
//      state ile açılır — bu durumda `onClose` prop'u verilir, router.back() ÇAĞRILMAZ
//      (çağrılırsa kullanıcıyı soru bankası sayfasına gelmeden ÖNCEKİ sayfaya atardı).
// Mobilde tam ekran, masaüstünde büyük ortalanmış panel.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { emitQuizModalClosed } from '../lib/panelRefreshBridge';

export default function QuizModal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  const router = useRouter();
  const close = () => {
    if (onClose) {
      onClose();
      return;
    }
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
        {/* İçerideki QuizClient zaten kendi yatay padding'ini (px-3 sm:px-4) veriyor — burada
            AYRICA px-4 vermek mobilde ikisini üst üste bindirip soruyu gereksiz yere
            daraltıyordu (kullanıcının "kenarlarda çok boşluk var" bildirimi, 2026-09-02).
            Mobilde yatay padding tamamen QuizClient'a bırakıldı, masaüstünde (daha geniş
            modal, sorun yok) eskisi gibi ekstra pay korunuyor. */}
        <div className="h-full overflow-y-auto pt-14 pb-8 sm:max-h-[90vh] sm:px-8">{children}</div>
      </div>
    </div>
  );
}
