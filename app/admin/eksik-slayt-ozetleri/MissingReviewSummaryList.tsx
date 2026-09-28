'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReviewSummaryBackfillModal } from '@/app/src/components/admin/AdminTopicSectionsPanel';

export type MissingReviewSummaryTopic = {
  topicId: number;
  title: string;
  context: string;
  missingCount: number;
};

export default function MissingReviewSummaryList({ topics }: { topics: MissingReviewSummaryTopic[] }) {
  const router = useRouter();
  const [openTopicId, setOpenTopicId] = useState<number | null>(null);
  const [savedAny, setSavedAny] = useState(false);

  function handleClose() {
    setOpenTopicId(null);
    // Modal kaydettikten sonra sonucu (eşleşmeyen başlıklar vb.) göstermek için açık kalıyor;
    // listeyi kapanınca tazele ki tamamlanan konu düşsün.
    if (savedAny) {
      setSavedAny(false);
      router.refresh();
    }
  }

  if (!topics.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Özeti eksik konu kalmadı. Bu geçici sayfa silinebilir.
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs font-bold text-muted-foreground">{topics.length} konu</p>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {topics.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{topic.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {topic.context} · {topic.missingCount} alt başlıkta eksik
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenTopicId(topic.topicId)}
              className="shrink-0 rounded-xl bg-[#6c63ff] px-3 py-2 text-xs font-extrabold text-white hover:bg-[#5a52e0] transition-colors"
            >
              Özet Ekle
            </button>
          </li>
        ))}
      </ul>
      {openTopicId != null && (
        <ReviewSummaryBackfillModal topicId={openTopicId} onClose={handleClose} onSaved={() => setSavedAny(true)} />
      )}
    </>
  );
}
