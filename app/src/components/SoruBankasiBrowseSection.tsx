'use client';

// Soru bankasının "İncele" (tüm sorular, cevap anahtarlı) bölümünü sarmalayan kutu.
//
// Açık/kapalı kuralı (2026-09-26 sadeleştirmesi):
//  - HERKESTE KAPALI başlar — asıl eylem üstteki test kartı (girişliye kayıtlı test,
//    misafire kapak + tam ekran mini test, bkz. GuestTestCover). Liste + optik form + test
//    kartı aynı anda görünüp sayfayı kalabalıklaştırıyordu. Optik form bu bölümün İÇİNDE
//    (position:fixed ama display:none'lı atanın altında) olduğu için kapalıyken o da görünmez.
//  - Kapaktaki "Cevap anahtarlı N soruyu incele" OPEN_QUESTION_LIST_EVENT ile açar.
//  - ?soru=ID paylaşım linki: giriş durumundan bağımsız HER ZAMAN AÇIK — 2026-09-08'de
//    bölüm girişlilere kapalıyken paylaşılan soru görünmüyordu, bu yüzden herkese açılmıştı.
//    Artık aynı sorunu hedefli çözüyoruz: link varsa açık kal, yoksa girişliye kapat.
//
// SEO KRİTİK: children (QuestionBankBoard, TÜM soruları içeren) HER ZAMAN koşulsuz render
// edilir — sadece CSS ile (display:none) gizlenir; açılır/sekmeli bölümlerdeki içerik Google
// tarafından indeksleniyor, bot ve kullanıcı AYNI HTML'i alıyor (cloaking değil). JS kapalıyken
// <noscript> override'ı bölümü açık gösterir (bkz. [konu]/page.tsx).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Info, Library } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FOCUS_QUESTION_EVENT, OPEN_QUESTION_LIST_EVENT } from '../lib/soruBankasiEvents';

const noopSubscribe = () => () => {};

export default function SoruBankasiBrowseSection({ questionCount, children }: { questionCount: number; children: React.ReactNode }) {
  const { user } = useAuth();
  // Sunucu snapshot'ı '' (ISR HTML'i parametresiz) — hydration uyuşmazlığı olmadan client'ta
  // gerçek ?soru= değerine geçer. useSearchParams burada Suspense sınırı isterdi.
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');
  const hasSharedQuestion = new URLSearchParams(search).has('soru');
  // null = kullanıcı henüz dokunmadı → varsayılan kural geçerli. Elle aç/kapa ya da bir
  // soruya yönlendirme bu değeri sabitler, sonradan gelen auth sonucu üstüne yazmaz.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? hasSharedQuestion;

  // ?soru=ID deep-link'i (bkz. QuestionBankHighlight.tsx) ve kapaktaki "incele" butonu bölümü
  // zorla açar.
  useEffect(() => {
    const handler = () => setManualOpen(true);
    window.addEventListener(FOCUS_QUESTION_EVENT, handler);
    window.addEventListener(OPEN_QUESTION_LIST_EVENT, handler);
    return () => {
      window.removeEventListener(FOCUS_QUESTION_EVENT, handler);
      window.removeEventListener(OPEN_QUESTION_LIST_EVENT, handler);
    };
  }, []);

  const toggle = () => setManualOpen(!open);

  return (
    <div className="overflow-hidden rounded-2xl border border-default bg-surface-elevated">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="soru-bankasi-listesi"
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface"
      >
        <span className="flex items-center gap-2.5 text-sm font-black text-default">
          <Library className="h-4 w-4 text-muted-foreground" /> Cevap anahtarlı tüm sorular ({questionCount})
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* display:none ile gizleniyor, DOM'dan kaldırılmıyor — bkz. dosya başı SEO notu. */}
      <div id="soru-bankasi-listesi" style={{ display: open ? undefined : 'none' }} className="border-t border-default p-3.5 sm:p-5">
        {user && (
          <p className="mb-3 flex items-start gap-2 rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-300 sm:mb-4">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Burada çözdüğün sorular istatistiğine kaydedilmez. Kaydetmek için yukarıdan testi başlat.
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
