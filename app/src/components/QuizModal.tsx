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
        // Eskiden sm:max-w-3xl (768px) ile sabitti — büyük ekranlarda (özellikle akıllı
        // tahta) modalın etrafında dev boşluklar bırakıp "acemice" görünüyordu
        // (kullanıcının 2026-09-22 sert şikayeti). Artık ekranın (94vw × 94vh) neredeyse
        // tamamını kullanıyor — sabit bir üst sınır YOK, çok büyük ekranlarda da oranı
        // koruyor (SlidePlayer'daki aynı yaklaşım).
        className="relative h-full w-full bg-surface sm:h-[94vh] sm:w-[94vw] sm:rounded-2xl sm:border sm:border-default"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Kapat"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-default/70 border border-default hover:text-default transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        {/* İçerideki QuizClient zaten kendi yatay padding'ini veriyor — burada AYRICA büyük
            padding vermek gereksiz boşluk yaratıyordu (kullanıcının "boşluklar çok fazla"
            şikayeti) — üst/yan dolgu azaltıldı. */}
        {/* İçerik modalın tam yüksekliğinden kısaysa (çoğu soru ekranı öyle) ortalanıyor —
            aksi halde dev boyuttaki modalın altında koca bir boşluk kalıyordu (kullanıcının
            2026-09-22 "acemice görünüyor" şikayeti). Uzun içerik (sonuç ekranı, cevap
            anahtarı vb.) yine normal şekilde yukarıdan başlayıp kayıyor. */}
        <div className="flex h-full flex-col overflow-y-auto pt-12 pb-4 sm:h-[94vh] sm:px-5">
          <div className="m-auto w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}
