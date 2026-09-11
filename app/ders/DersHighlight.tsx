'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Profildeki "Yorumlarım" / bildirimlerden gelen ?yorum=c88 (yorum) veya a56 (AI
// cevabı) deep-link'lerini okuyup DersClient'a bir event ile bildirir — tıpkı
// QuestionBankHighlight.tsx'in soru bankası için yaptığı gibi (aynı desen, konu
// sayfası için). DersClient zaten her zaman defaultExpanded=true ile açık geldiği
// için ayrıca bir "paneli aç" event'ine gerek yok, sadece hangi kayda kaydırılacağı
// yeterli. useSearchParams'ı doğrudan DersClient'a (SSR/ISR'li ağır bir server
// component'in client child'ı) koymak yerine ayrı, küçük bir component'te tutmak
// sayfanın statik render'ını bozmuyor (bkz. QuestionBankHighlight.tsx'teki aynı not).
export default function DersHighlight() {
  const searchParams = useSearchParams();
  const highlightTarget = searchParams?.get('yorum') || null;

  useEffect(() => {
    if (!highlightTarget) return;

    // DersClient'ın event listener'ı mount effect'inde senkron eklenir — rAF bir
    // sonraki paint'e kadar beklediği için dispatch her zaman listener bağlandıktan
    // sonra gerçekleşir (bkz. QuestionBankHighlight.tsx'teki aynı teknik).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('ders:highlight-comment', { detail: { target: highlightTarget } }));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [highlightTarget]);

  return null;
}
