'use client';

// Soru bankası konu sayfasında misafirin gördüğü test kartı içeriği (TestStatusCard'ın
// guestContent'i). 2026-10-03 yenilemesi: sorular artık sayfada açık listelendiği için kart
// yalnız süreli mini testi tanıtır — kısa açıklama, üç madde, tek buton, giriş satırı.
// SEO: kart sayfa AKIŞINDA (pop-up/interstitial değil).
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Play } from 'lucide-react';
import dynamic from 'next/dynamic';

// Modal (soru bileşenleri, KaTeX vb.) sadece "Teste başla"ya basılınca yüklenir — sayfanın
// ilk JS'i (ve dolayısıyla Core Web Vitals / SEO) büyümesin.
const QuizPlayerModal = dynamic(() => import('./QuizPlayerModal'), { ssr: false });

const FEATURES = ['Soru başına 60 saniye', 'Anında doğru / yanlış', 'Her sorunun açıklaması'];

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

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm text-muted-foreground">Bu konudan {testSize} soruluk süreli bir test çöz, nerede olduğunu gör.</p>
      <ul className="flex flex-col gap-1.5 text-sm text-default">
        {FEATURES.map((text) => (
          <li key={text} className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" /> {text}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 font-semibold text-white transition-colors hover:bg-indigo-700"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Teste başla
      </button>

      <p className="text-sm text-muted-foreground">
        Üye misin?{' '}
        <Link href={`/login?redirectTo=${encodeURIComponent(pathname || '/')}`} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
          Giriş yap
        </Link>
        , sonuçların kaydedilsin.
      </p>

      {open && <QuizPlayerModal topicId={topicId} topicTitle={topicTitle} eyebrowText={eyebrowText} onClose={() => setOpen(false)} />}
    </div>
  );
}
