import LessonUnitsPageClient from './LessonUnitsPageClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
}

export default async function LessonUnitsPage({ params }: { params: Promise<Params> }) {
  const { gradeSlug, lessonSlug } = await params;
  return <LessonUnitsPageClient gradeSlug={gradeSlug} lessonSlug={lessonSlug} />;
}
