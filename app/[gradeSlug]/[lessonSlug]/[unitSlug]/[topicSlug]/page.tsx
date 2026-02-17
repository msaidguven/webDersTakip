import TopicDetailPageClient from './TopicDetailPageClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

export default async function TopicDetailPage({ params }: { params: Promise<Params> }) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  return <TopicDetailPageClient gradeSlug={gradeSlug} lessonSlug={lessonSlug} unitSlug={unitSlug} topicSlug={topicSlug} />;
}
