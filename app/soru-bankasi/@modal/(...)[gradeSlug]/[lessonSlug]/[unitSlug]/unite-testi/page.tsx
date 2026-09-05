// Soru bankasından "Teste Başla"/"Devam Et" (ünite testi) tıklanınca aynı /.../unite-testi
// URL'ini overlay olarak açan intercepting route — panelin kardeş dosyasıyla (bkz.
// app/panel/@modal/(...)[gradeSlug]/.../unite-testi/page.tsx) AYNI paylaşılan
// UnitTestModalContent'i çağırıyor, tek fark "X'e Dön" linkinin soru bankası sayfasına
// gitmesi (varsayılan davranış ünitenin ilk konusuna dönerdi, bkz. QuizModalContent.tsx).

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

export default async function SoruBankasiUnitTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  return (
    <UnitTestModalContent
      gradeSlug={gradeSlug}
      lessonSlug={lessonSlug}
      unitSlug={unitSlug}
      exitHref={`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}`}
      exitLabel="Soru Bankasına Dön"
    />
  );
}
