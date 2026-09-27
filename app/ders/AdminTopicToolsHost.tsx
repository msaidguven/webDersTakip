'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import type { AdminTopicPanelKey } from '@/app/src/components/admin/AdminTopicSectionsPanel';

// İçerik yönetimi araçları ders sayfasında, ayrı admin sayfasına gitmeden açılıyor
// (kullanıcının 2026-09-26 isteği: /admin/konu-icerik/[id] çok yavaştı). 5000+ satırlık
// panel öğrencinin bundle'ına girmesin diye dinamik import — sadece admin için, admin
// olduğu anlaşılınca arka planda önceden yükleniyor (preloadAdminTopicTools), böylece
// menüden tıklayınca kod hazır, sadece o aracın verisi çekiliyor.
const loadPanel = () => import('@/app/src/components/admin/AdminTopicSectionsPanel');
const AdminTopicSectionsPanel = dynamic(loadPanel, { ssr: false });

export function preloadAdminTopicTools() {
  void loadPanel();
}

export type AdminToolRequest = { panel: AdminTopicPanelKey | 'all'; sectionId?: number | null };

// "İçerik Yönetimi" açılır menüsü — her satır ilgili aracı bu sayfada, modal olarak açar
// (bkz. AdminTopicToolsHost; eskiden /admin/konu-icerik/[topicId]?panel=X'e gidiyordu, o
// sayfa çok yavaştı — kullanıcının 2026-09-26 isteğiyle ders sayfasına geri alındı). Sadece
// TOPIC seviyesindeki araçlar burada — alt başlık bazlı araçlar SECTION_ADMIN_TOOLS_MENU'de.
export const ADMIN_TOOLS_MENU: { panel: AdminTopicPanelKey; label: string }[] = [
  { panel: 'plan', label: 'Alt Başlık Planı Prompt\'u' },
  { panel: 'cover-image', label: 'Konu Kapak Görseli' },
  { panel: 'highlights', label: 'Anahtar Kavramları Güncelle (AI)' },
  { panel: 'highlight-quick-add', label: 'Anahtar Kavram Ekle' },
  { panel: 'topic-summary', label: 'Konu Özetini Düzenle' },
  { panel: 'review-summary', label: 'Eksik Özetleri AI ile Tamamla' },
  { panel: 'topic-questions-general', label: 'Genel Sorular' },
  { panel: 'topic-questions-classical', label: 'Açık Uçlu Sorular' },
  { panel: 'classical-generate', label: 'Açık Uçlu Soru Üret (AI)' },
  { panel: 'notebooklm-setup', label: 'NotebookLM Kurulum' },
];

// Alt başlık (section) bazlı araçlar — her alt başlığın kendi menüsünden o alt başlık için
// açılır (kullanıcının 2026-09-21 isteği: "özellikle diyagram resim güncelleme için kullanabilirim").
// İçerik/soru üretimi gibi kaynak varyantı (NotebookLM/sentez) gerektiren araçlar burada YOK —
// o varyant admin panelinde contentSourceKind'e göre belirleniyor, deep-link'te belirsiz kalırdı.
export const SECTION_ADMIN_TOOLS_MENU: { panel: AdminTopicPanelKey; label: string }[] = [
  { panel: 'image', label: 'Görsel Ekle/Güncelle' },
  { panel: 'diagram', label: 'Diyagram Ekle/Güncelle' },
  { panel: 'video', label: 'Video Ekle/Güncelle' },
  { panel: 'video-suggestion', label: 'YouTube Önerisi' },
];


export default function AdminTopicToolsHost({
  topicId,
  request,
  onClose,
}: {
  topicId: number;
  request: AdminToolRequest;
  onClose: () => void;
}) {
  const isDrawer = request.panel === 'all';

  useEffect(() => {
    if (!isDrawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isDrawer, onClose]);

  if (request.panel !== 'all') {
    return (
      <AdminTopicSectionsPanel
        key={`${topicId}-${request.panel}-${request.sectionId ?? ''}`}
        topicId={topicId}
        initialPanel={request.panel}
        initialSectionId={request.sectionId ?? null}
        modalOnly
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="İçerik yönetimi">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-4xl flex-col bg-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-black text-foreground">İçerik Yönetimi — Tüm Araçlar</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <AdminTopicSectionsPanel key={topicId} topicId={topicId} />
        </div>
      </div>
    </div>
  );
}
