import UnitTopicsPageClient from './UnitTopicsPageClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

export default async function UnitTopicsPage({ params }: { params: Promise<Params> }) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  return <UnitTopicsPageClient gradeSlug={gradeSlug} lessonSlug={lessonSlug} unitSlug={unitSlug} />;
}
