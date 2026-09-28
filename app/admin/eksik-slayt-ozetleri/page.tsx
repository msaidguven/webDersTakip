import Link from 'next/link';
import AdminThemeToggle from '@/app/src/components/admin/AdminThemeToggle';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import MissingReviewSummaryList, { type MissingReviewSummaryTopic } from './MissingReviewSummaryList';

export const dynamic = 'force-dynamic';

// GEÇİCİ sayfa (kullanıcının 2026-09-28 isteği): review_summary alanı (2026-09-15) eklenmeden
// önce yayınlanan konularda slayt maddeleri ders notundan kaba cümle bölmeyle türetiliyor
// (bkz. topicSlideDeck.ts deriveBullets). Bu liste o konuları toplar; admin mevcut
// ReviewSummaryBackfillModal ile promptu kopyalayıp sonucu yapıştırır. Liste boşalınca bu
// klasör ve admin ana sayfasındaki bağlantısı silinebilir.
type SectionRow = {
  topic_contents: {
    topics: {
      id: number;
      title: string;
      units: { title: string; lessons: { name: string }; grades: { name: string; order_no: number } };
    };
  };
};

async function loadMissingTopics(): Promise<MissingReviewSummaryTopic[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('topic_content_sections')
    .select(
      'topic_contents!inner(topics!inner(id, title, units!inner(title, lessons!inner(name), grades!inner(name, order_no))))'
    )
    .or('review_summary.is.null,review_summary.eq.')
    .eq('topic_contents.is_published', true)
    .eq('topic_contents.topics.is_active', true)
    .eq('topic_contents.topics.units.is_active', true)
    .eq('topic_contents.topics.units.lessons.is_active', true)
    .eq('topic_contents.topics.units.grades.is_active', true);
  if (error) throw new Error(`Eksik özet sorgusu başarısız: ${error.message}`);

  const byTopic = new Map<number, MissingReviewSummaryTopic>();
  const gradeOrder = new Map<number, number>();
  for (const row of (data as unknown as SectionRow[] | null) || []) {
    const t = row.topic_contents.topics;
    const existing = byTopic.get(t.id);
    if (existing) {
      existing.missingCount++;
      continue;
    }
    byTopic.set(t.id, {
      topicId: t.id,
      title: t.title,
      context: `${t.units.grades.name} · ${t.units.lessons.name} · ${t.units.title}`,
      missingCount: 1,
    });
    gradeOrder.set(t.id, t.units.grades.order_no);
  }
  return [...byTopic.values()]
    .sort(
      (a, b) =>
        gradeOrder.get(a.topicId)! - gradeOrder.get(b.topicId)! ||
        a.context.localeCompare(b.context, 'tr') ||
        a.title.localeCompare(b.title, 'tr')
    );
}

export default async function EksikSlaytOzetleriPage() {
  const topics = await loadMissingTopics();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center gap-4">
        <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <span>←</span> Admin Paneline Dön
        </Link>
        <h1 className="font-bold text-foreground text-sm sm:text-base flex-1">Eksik Slayt Özetleri</h1>
        <AdminThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <p className="mb-4 text-sm text-muted-foreground">
          Bu konuların alt başlıklarında slayt özeti yok, sunumdaki maddeler ders notundan kaba şekilde bölünüyor.
          Özeti kaydedilen konu listeden düşer.
        </p>
        <MissingReviewSummaryList topics={topics} />
      </main>
    </div>
  );
}
