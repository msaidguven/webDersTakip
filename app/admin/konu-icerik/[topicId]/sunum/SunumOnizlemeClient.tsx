'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SlidePlayer from '@/app/src/components/SlidePlayer';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

export default function SunumOnizlemeClient({ topicId }: { topicId: number }) {
  const router = useRouter();
  const [deck, setDeck] = useState<SlideDeck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/topic-sections/slides?topicId=${topicId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || 'Sunum yüklenemedi');
          return;
        }
        const data = await res.json();
        setDeck(data.deck as SlideDeck);
      })
      .catch(() => setError('Ağ hatası oluştu'));
  }, [topicId]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-900 text-white">
        <p className="text-sm font-bold text-red-300">{error}</p>
        <Link href={`/admin/konu-icerik/${topicId}`} className="text-xs text-slate-300 underline">
          Konu içerik yönetimine dön
        </Link>
      </div>
    );
  }

  if (!deck) {
    return <div className="flex h-screen items-center justify-center bg-slate-900 text-sm text-slate-300">Yükleniyor...</div>;
  }

  return <SlidePlayer deck={deck} onClose={() => router.push(`/admin/konu-icerik/${topicId}`)} />;
}
