import GradePageClient from './GradePageClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
}

export default async function GradePage({ params }: { params: Params }) {
  // Client-side rendering - veriyi client çekecek
  return <GradePageClient gradeSlug={params.gradeSlug} />;
}
