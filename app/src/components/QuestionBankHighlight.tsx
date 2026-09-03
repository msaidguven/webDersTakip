'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// ?soru=ID ile gelen paylaşım linkleri için: sayfa yüklendiğinde ilgili soruya scroll edip
// kısa bir "flash" ile dikkat çeker, ardından ince/kalıcı bir "aktif soru" halkası bırakır.
// ?soru= artık sunucuda okunmuyor (searchParams okumak sayfayı ISR cache'inden çıkarırdı —
// bkz. page.tsx'teki not), bu yüzden id'yi burada, client'ta okuyoruz. Sayfada gerçekten var
// olup olmadığını da document.getElementById zaten doğal olarak doğruluyor (element yoksa
// hiçbir şey yapmıyoruz) — ayrıca server-side bir soru listesi doğrulamasına gerek yok.
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
  // hâlâ sadece soruyu vurgular, yorumları açmaz — ikisi aynı parametreyi paylaştığı
  // için önceden her ?soru= linki yorumları da açıyordu (kullanıcı bildirimi, 2026-09-04).
  const highlightTarget = searchParams?.get('yorum') || null;

  useEffect(() => {
    if (activeQuestionId == null) return;

    // Sorulardaki SVG'ler (QuestionSvg, bkz. QuizClient.tsx) SSR sırasında window
    // olmadığı için mount SONRASI kendi useEffect'lerinde render oluyor — yani bu efekt
    // çalıştığı anda sayfanın gerçek yüksekliği henüz oturmamış olabilir (SVG'ler henüz
    // DOM'a girmemiş). Hemen scrollIntoView çağırırsak hedef, üstündeki SVG'ler DOM'a
    // girdikçe aşağı kayar ve scroll eski (kısa) yüksekliğe göre hesaplanmış kalır. İki
    // requestAnimationFrame beklemek, o ikinci render+paint turunun bitmesini garantiler.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        // QuestionBankBoard bu event'i dinleyip, yorum hedefi varsa ilgili kartın
        // yorum panelini (varsayılan kapalı, bkz. UnitDiscussion) otomatik açıyor.
        // İki rAF sonrasına bilerek bırakıldı: QuestionBankBoard bu component'ten
        // sonra mount olsa bile, kendi mount effect'i (event listener'ı ekleyen)
        // senkron olarak ilk commit'te çalışır — rAF ise bir sonraki paint'e kadar
        // bekler, yani listener her zaman dispatch'ten önce bağlanmış olur.
        if (highlightTarget) {
          window.dispatchEvent(
            new CustomEvent('soru-bankasi:open-comments', { detail: { questionId: activeQuestionId, target: highlightTarget } })
          );
        }

        const el = document.getElementById(`soru-${activeQuestionId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-2', 'ring-indigo-500', 'animate-pulse');
        setTimeout(() => el.classList.remove('animate-pulse'), 2200);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [activeQuestionId, highlightTarget]);

  return null;
}
