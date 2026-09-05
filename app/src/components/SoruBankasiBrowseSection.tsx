'use client';

// Soru bankasının "İncele" (100 soru, cevap anahtarlı) bölümünü sarmalayan, giriş durumuna
// göre varsayılan açık/kapalı olan katlanır kutu — kullanıcının 2026-09-05 isteği: giriş
// yapmamışsa direkt 100 soruyu görsün (mevcut davranış), giriş yapmışsa üstteki
// TestStatusCard'daki kişiselleştirilmiş 10 soruluk test öne çıksın, 100 soruluk banka
// "Soru Bankası — N Soru" başlığıyla kapalı bir bölüm olarak altta kalsın.
//
// SEO KRİTİK: children (QuestionBankBoard, TÜM soruları içeren) HER ZAMAN koşulsuz render
// edilir — sadece CSS ile (display:none, tek soru modundaki aynı teknik) gizlenir/gösterilir.
// İlk (sunucu) render'da state HER ZAMAN "açık" — hangi kullanıcı olursa olsun, crawler dahil,
// başlangıç HTML'i her zaman tam içerikli. Giriş durumu SADECE mount SONRASI, client'ta
// öğrenilip (varsa) kapatmak için kullanılıyor — bu yüzden hydration uyuşmazlığı da olmuyor
// (sunucu ve client'ın ilk render'ı birebir aynı: açık).
import { useEffect, useState } from 'react';
import { ChevronDown, Library } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SoruBankasiBrowseSection({ questionCount, children }: { questionCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) setOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ?soru=ID ile bir soruya deep-link'lenmişse (bkz. QuestionBankHighlight.tsx) bölüm
  // kapalı kalırsa hedef soru görünmez olurdu — bu event geldiğinde giriş durumundan
  // BAĞIMSIZ olarak zorla açıyoruz.
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
