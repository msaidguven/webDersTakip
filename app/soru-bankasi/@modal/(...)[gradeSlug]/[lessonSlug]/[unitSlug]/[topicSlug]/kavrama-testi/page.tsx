// Soru bankasından "Teste Başla"/"Devam Et" tıklanınca aynı /.../kavrama-testi URL'ini
// overlay olarak açan intercepting route — panelin kardeş dosyasıyla (bkz.
// app/panel/@modal/(...)[gradeSlug]/.../kavrama-testi/page.tsx) AYNI paylaşılan
// TopicTestModalContent'i çağırıyor, tek fark "X'e Dön" linkinin soru bankası sayfasına
// gitmesi. Doğrudan bu URL'e girilirse Next.js bu route'u değil, gerçek page.tsx'i render eder.

import { TopicTestModalContent } from '@/app/src/components/QuizModalContent';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function SoruBankasiTopicTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  return (
    <TopicTestModalContent
      gradeSlug={gradeSlug}
      lessonSlug={lessonSlug}
      unitSlug={unitSlug}
      topicSlug={topicSlug}
      exitHref={`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`}
      exitLabel="Soru Bankasına Dön"
    />
  );
}
