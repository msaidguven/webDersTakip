'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// ?soru=ID ile gelen paylaşım linkleri için: sayfa yüklendiğinde ilgili soruyu gösterir.
// Artık scroll+highlight YAPMIYOR — QuestionBankBoard tek soru moduna geçtiğinden (bkz.
// kullanıcının 2026-09-05 isteği) "o soruyu göster" demek activeIndex'i değiştirmek demek,
// bunu QuestionBankBoard'a bir event ile bildiriyoruz (o soru zaten SEO için DOM'da tam
// olarak var, sadece hangisinin görünür olduğu değişiyor). ?soru= artık sunucuda okunmuyor
// (searchParams okumak bu sayfayı ISR cache'inden çıkarırdı — bkz. page.tsx'teki not), bu
// yüzden id'yi burada, client'ta okuyoruz.
export default function QuestionBankHighlight() {
  const searchParams = useSearchParams();
  const activeQuestionId = (() => {
    const raw = searchParams?.get('soru');
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) && id > 0 ? id : null;
  })();
  // Profildeki "Yorumlarım"dan gelen linkler ?soru=ID&yorum=c88 (yorum) / a56 (AI
  // cevabı) şeklinde ek bir hedef taşır — SADECE bu parametre varsa yorum paneli
  // otomatik açılıp o kayda kaydırılır. Düz ?soru=ID linkleri (ör. "paylaş" butonu)
  // hâlâ sadece soruyu gösterir, yorumları açmaz — ikisi aynı parametreyi paylaştığı
  // için önceden her ?soru= linki yorumları da açıyordu (kullanıcı bildirimi, 2026-09-04).
  const highlightTarget = searchParams?.get('yorum') || null;

  useEffect(() => {
    if (activeQuestionId == null) return;

    // QuestionBankBoard'un mount effect'i (event listener'ları ekleyen) senkron olarak
    // ilk commit'te çalışır — rAF bir sonraki paint'e kadar beklediği için dispatch her
    // zaman listener'lar bağlandıktan sonra gerçekleşir (bkz. QuestionBankBoard.tsx).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('soru-bankasi:focus-question', { detail: { questionId: activeQuestionId } }));
        if (highlightTarget) {
          window.dispatchEvent(
            new CustomEvent('soru-bankasi:open-comments', { detail: { questionId: activeQuestionId, target: highlightTarget } })
          );
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [activeQuestionId, highlightTarget]);

  return null;
}
