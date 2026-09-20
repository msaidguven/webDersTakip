import SunumOnizlemeClient from './SunumOnizlemeClient';

export const dynamic = 'force-dynamic';

export default async function SunumOnizlemePage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  const topicIdNum = Number(topicId);

  if (!Number.isFinite(topicIdNum)) {
    return <p className="p-6 text-sm text-muted-foreground">Geçersiz konu id.</p>;
  }

  return <SunumOnizlemeClient topicId={topicIdNum} />;
}
