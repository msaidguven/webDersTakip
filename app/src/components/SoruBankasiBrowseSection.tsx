'use client';

// Soru bankasının "İncele" (100 soru, cevap anahtarlı) bölümünü sarmalayan kutu — kullanıcının
// 2026-09-06 isteği: giriş yapmamışsa direkt soruları görsün (mevcut davranış, "Teste Başla"
// zaten TestStatusCard'da devre dışı), giriş yapmışsa bu bölüm HİÇ görünmesin — kişiselleştirilmiş
// teste yönlensin, cevapları burada okuyup "çözmüş" gibi görünmesin.
//
// SEO KRİTİK: children (QuestionBankBoard, TÜM soruları içeren) HER ZAMAN koşulsuz render
// edilir — sadece CSS ile (display:none, tek soru modundaki aynı teknik) gizlenir/gösterilir.
// İlk (sunucu) render'da state HER ZAMAN "açık" — hangi kullanıcı olursa olsun, crawler dahil
// (Googlebot zaten oturumsuz/misafir sayılır), başlangıç HTML'i her zaman tam içerikli. Giriş
// durumu SADECE mount SONRASI, client'ta öğrenilip gizlemek için kullanılıyor — bu yüzden
// hydration uyuşmazlığı da olmuyor (sunucu ve client'ın ilk render'ı birebir aynı: açık).
import { useEffect, useState } from 'react';
import { ChevronDown, Library } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SoruBankasiBrowseSection({ questionCount, children }: { questionCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  // true olunca bölüm TAMAMEN gizlenir (başlık dahil) — sadece giriş yapmış kullanıcıda,
  // sadece mount sonrası. Deep-link (?soru=ID) geldiğinde bu FALSE'a dönüp bölüm yeniden
  // görünür olur — paylaşılan bir soru linki giriş yapmış kullanıcıda da çalışmaya devam eder.
  const [hiddenForLoggedIn, setHiddenForLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) {
        setOpen(false);
        setHiddenForLoggedIn(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ?soru=ID ile bir soruya deep-link'lenmişse (bkz. QuestionBankHighlight.tsx) bölüm
  // kapalı/gizli kalırsa hedef soru görünmez olurdu — bu event geldiğinde giriş durumundan
  // BAĞIMSIZ olarak zorla açıyoruz.
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setHiddenForLoggedIn(false);
    };
    window.addEventListener('soru-bankasi:focus-question', handler);
    return () => window.removeEventListener('soru-bankasi:focus-question', handler);
  }, []);

  if (hiddenForLoggedIn) return null;

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
