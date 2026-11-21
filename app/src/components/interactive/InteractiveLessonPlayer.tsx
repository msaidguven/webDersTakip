'use client';

// Etkileşimli ders yönlendiricisi (v1 → v2 → v3 versiyonlu mimari).
// /api/interactive-lesson yanıtındaki `version` alanına göre uygun oynatıcıyı yükler:
// - version === 2 → PlayerV2 (oyunlaştırılmış yeni deneyim)
// - version === 1 (veya tanımsız) → InteractiveLessonPlayerV1 (mevcut v1 oynatıcı, hiç bozulmadan)
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X } from 'lucide-react';
import type { HydratedLesson } from '@/app/src/lib/interactiveLesson/types';
import { isHydratedV2, type HydratedLessonV2 } from '@/app/src/lib/interactiveLesson/typesV2';
import { isHydratedV3, type HydratedLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';

const PlayerV1 = dynamic(() => import('./InteractiveLessonPlayerV1'), { ssr: false });
const PlayerV2 = dynamic(() => import('./v2/PlayerV2'), { ssr: false });
const PlayerV3 = dynamic(() => import('./v3/PlayerV3'), { ssr: false });

type Props = { topicId: number; onClose: () => void };
type LoadedLesson = (HydratedLesson & { version?: 1 }) | HydratedLessonV2 | HydratedLessonV3;

export default function InteractiveLessonPlayer({ topicId, onClose }: Props) {
  const [lesson, setLesson] = useState<LoadedLesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/interactive-lesson?topicId=${topicId}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
        setLesson(data as LoadedLesson);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      });
    return () => controller.abort();
  }, [topicId]);

  if (lesson) {
    if (isHydratedV3(lesson)) {
      return <PlayerV3 lesson={lesson} onClose={onClose} />;
    }
    if (isHydratedV2(lesson)) {
      return <PlayerV2 lesson={lesson} onClose={onClose} />;
    }
    return <PlayerV1 topicId={topicId} onClose={onClose} initialLesson={lesson} />;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#171440] p-6 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Etkileşimli ders yükleniyor"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {error ? (
        <div className="max-w-md space-y-4 text-center">
          <p className="text-lg font-bold text-rose-200">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-extrabold text-slate-900"
          >
            Kapat
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-sky-300" aria-label="Yükleniyor" />
          <p className="text-sm font-bold text-sky-100">Ders hazırlanıyor…</p>
        </div>
      )}
    </div>
  );
}
