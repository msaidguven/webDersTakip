'use client';

// Soru bankasının "İncele" (100 soru, cevap anahtarlı) bölümünü sarmalayan kutu — giriş
// durumundan bağımsız olarak HERKESTE açık/görünür (kullanıcının 2026-09-08 isteği: daha
// önce giriş yapan kullanıcıda tamamen gizleniyordu, bu da mobildeki soru haritası dahil
// tüm "İncele" özelliğini görünmez kılıyordu — kaldırıldı).
//
// SEO KRİTİK: children (QuestionBankBoard, TÜM soruları içeren) HER ZAMAN koşulsuz render
// edilir — sadece CSS ile (display:none, tek soru modundaki aynı teknik) gizlenir/gösterilir.
import { useEffect, useState } from 'react';
import { ChevronDown, Library } from 'lucide-react';

export default function SoruBankasiBrowseSection({ questionCount, children }: { questionCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  // ?soru=ID ile bir soruya deep-link'lenmişse (bkz. QuestionBankHighlight.tsx) ve kullanıcı
  // bölümü elle kapatmışsa hedef soru görünmez olurdu — bu event geldiğinde zorla açıyoruz.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('soru-bankasi:focus-question', handler);
    return () => window.removeEventListener('soru-bankasi:focus-question', handler);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-default bg-surface-elevated">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface"
      >
        <span className="flex items-center gap-2.5 text-sm font-black text-default">
          <Library className="h-4 w-4 text-muted-foreground" /> Soru Bankası — {questionCount} Soru
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* display:none ile gizleniyor, DOM'dan kaldırılmıyor — bkz. dosya başı SEO notu. */}
      <div style={{ display: open ? undefined : 'none' }} className="border-t border-default p-3.5 sm:p-5">
        {children}
      </div>
    </div>
  );
}
