'use client';

// Soru bankası konu sayfasının soru listesi bölümü (2026-10-03 yenilemesi): artık HERKESTE AÇIK
// (eskiden katlanmış kutu — sayfanın asıl içeriği olan sorular tıklanmadan görünmüyordu).
// Başlık izleyene göre değişir: öğrenci yalnız testte çözdüğü soruları görür (bkz.
// useQuestionBankViewer), misafir/öğretmen/admin tüm cevap anahtarını.
//
// SEO KRİTİK: children (QuestionBankBoard, TÜM soruları içeren) her zaman koşulsuz render edilir.
// Başlık metni sunucuda misafir sürümüyle gelir; öğrenci başlığı client'ta değişir.
import { useEffect } from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuestionBankViewer } from '../hooks/useQuestionBankViewer';
import { OPEN_QUESTION_LIST_EVENT } from '../lib/soruBankasiEvents';

export default function SoruBankasiBrowseSection({ questionCount, questionIds, children }: { questionCount: number; questionIds: number[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const viewer = useQuestionBankViewer(questionIds);
  const studentMode = viewer.status === 'student';

  // Eski "N soruyu incele" bağlantıları (OPEN_QUESTION_LIST_EVENT) artık yalnız listeye kaydırır.
  useEffect(() => {
    const handler = () => document.getElementById('sorular')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.addEventListener(OPEN_QUESTION_LIST_EVENT, handler);
    return () => window.removeEventListener(OPEN_QUESTION_LIST_EVENT, handler);
  }, []);

  return (
    <section aria-labelledby="sorular" className="flex flex-col">
      <h2 id="sorular" className="scroll-mt-24 text-xl font-bold tracking-tight text-default sm:text-2xl">
        {studentMode ? 'Çözdüğün sorular' : 'Sorular ve cevap anahtarı'}
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        {studentMode
          ? `Testte çözdüğün sorular cevaplarıyla burada. Kalan ${Math.max(0, questionCount - viewer.stats.size)} soru testte karşına çıkacak.`
          : `${questionCount} soru. Önce kendin çöz, sonra cevabı ve açıklamayı gör.`}
      </p>
      {user && viewer.status === 'staff' && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-indigo-500/10 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Öğretmen/admin görünümü: tüm sorular. Öğrenciler burada yalnız testte çözdükleri soruları görür.
        </p>
      )}
      <div id="soru-bankasi-listesi">{children}</div>
    </section>
  );
}
