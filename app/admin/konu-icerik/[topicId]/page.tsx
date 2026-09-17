import Link from 'next/link';
import AdminTopicSectionsPanel from '@/app/src/components/admin/AdminTopicSectionsPanel';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';
import TopicNavSidebar from '@/app/src/components/admin/TopicNavSidebar';

export const dynamic = 'force-dynamic';

// Eskiden ders sayfasında (DersClient.tsx) bir modal olarak açılan içerik üretim araçlarının
// (İçerik/Görsel/Diyagram/Video/YouTube/Sorular/RAG/Kapak/Anahtar Kavram) hepsi artık burada,
// kendi sayfasında — öğrencinin gördüğü canlı sayfadan onlarca admin-only state/buton/modal
// çıktı (kullanıcının 2026-09-17 isteği). Sol taraftaki TopicNavSidebar, başka bir konuya
// hızlıca geçebilmek için sonradan eklendi (kullanıcının 2026-09-17 ikinci isteği).
export default async function KonuIcerikPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const topicIdNum = Number(topicId);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4 shrink-0">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Konu İçerik Yönetimi</h1>
        <AdminThemeToggle />
      </header>
      <div className="flex flex-1 min-h-0">
        {Number.isFinite(topicIdNum) && (
          <div className="hidden md:block">
            <TopicNavSidebar activeTopicId={topicIdNum} />
          </div>
        )}
        <main className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="max-w-4xl mx-auto">
            {Number.isFinite(topicIdNum) ? (
              <AdminTopicSectionsPanel topicId={topicIdNum} />
            ) : (
              <p className="text-sm text-muted-foreground">Geçersiz konu id.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
