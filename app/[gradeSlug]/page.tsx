import GradePageClient from './GradePageClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
}

export default async function GradePage({ params }: { params: Promise<Params> }) {
  const { gradeSlug } = await params;
  return <GradePageClient gradeSlug={gradeSlug} />;
}
