'use client';

import { X } from 'lucide-react';
import AdminTopicSectionsPanel from './AdminTopicSectionsPanel';

export default function AdminTopicSectionsModal({ topicId, topicTitle, onClose }: { topicId: number; topicTitle?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-muted-foreground">İçerik Yönetimi</div>
            {topicTitle && <h3 className="text-base font-black text-foreground">{topicTitle}</h3>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <AdminTopicSectionsPanel topicId={topicId} />
      </div>
    </div>
  );
}
