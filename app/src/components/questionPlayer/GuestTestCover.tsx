'use client';

// Soru bankası konu sayfasında misafirin gördüğü "kapak" (2026-09-26): soruları doğrudan
// listelemek yerine kısa bir tanıtım + tam ekran mini test. SEO: bu kart sayfa AKIŞINDA
// (içeriği örten bir pop-up/interstitial değil); soruların tamamı hâlâ sunucu HTML'inde,
// aşağıdaki açılır bölümde (bkz. SoruBankasiBrowseSection).
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, ChevronDown, Clock, Lightbulb, Play } from 'lucide-react';
import dynamic from 'next/dynamic';
import { OPEN_QUESTION_LIST_EVENT } from '@/app/src/lib/soruBankasiEvents';

// Modal (soru bileşenleri, KaTeX vb.) sadece "Teste Başla"ya basılınca yüklenir — sayfanın
// ilk JS'i (ve dolayısıyla Core Web Vitals / SEO) büyümesin.
const QuizPlayerModal = dynamic(() => import('./QuizPlayerModal'), { ssr: false });

const FEATURES = [
  { icon: Clock, text: 'Soru başına 60 sn' },
  { icon: CheckCircle2, text: 'Anında doğru/yanlış' },
  { icon: Lightbulb, text: 'Her sorunun açıklaması' },
];

export default function GuestTestCover({
  topicId,
  topicTitle,
  eyebrowText,
  questionCount,
}: {
  topicId: number;
  topicTitle: string;
  eyebrowText: string;
  questionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const testSize = Math.min(10, questionCount);

  const openList = () => {
    window.dispatchEvent(new CustomEvent(OPEN_QUESTION_LIST_EVENT));
    requestAnimationFrame(() => document.getElementById('soru-bankasi-listesi')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div>
        <p className="text-sm font-bold text-muted-foreground">Kendini dene: {testSize} soruluk mini test</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2">
        {FEATURES.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-default">
            <Icon className="h-3.5 w-3.5 text-indigo-500" aria-hidden /> {text}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3.5 text-base font-black text-white shadow-lg shadow-indigo-500/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <Play className="h-5 w-5 fill-current" aria-hidden /> Teste Başla
      </button>

      <div className="flex w-full flex-col items-center gap-1.5 text-xs font-bold sm:flex-row sm:justify-between">
        <button type="button" onClick={openList} className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-indigo-500">
          Cevap anahtarlı {questionCount} soruyu incele <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        <span className="text-muted-foreground">
          Üye misin?{' '}
          <Link href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="text-indigo-500 hover:text-indigo-400">
            Giriş yap
          </Link>
          , sonuçların kaydedilsin
        </span>
      </div>

      {open && <QuizPlayerModal topicId={topicId} topicTitle={topicTitle} eyebrowText={eyebrowText} onClose={() => setOpen(false)} />}
    </div>
  );
}
