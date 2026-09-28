// Panelden "Test Çöz" / "Devam Et" (ünite testi) tıklanınca aynı /.../unite-testi URL'ini
// overlay olarak açan intercepting route. Gerçek içerik artık paylaşılan
// UnitTestModalContent'te (bkz. app/src/components/QuizModalContent.tsx, kardeş dosya:
// .../kavrama-testi/page.tsx).

import { UnitTestModalContent } from '@/app/src/components/QuizModalContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function UnitTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  return <UnitTestModalContent gradeSlug={gradeSlug} lessonSlug={lessonSlug} unitSlug={unitSlug} />;
}
