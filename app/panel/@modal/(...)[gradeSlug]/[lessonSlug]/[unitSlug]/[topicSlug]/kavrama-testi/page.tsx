// Panelden "Soru Çöz" / "Devam Et" tıklanınca aynı /.../kavrama-testi URL'ini overlay olarak
// açan intercepting route. Gerçek içerik/oturum mantığı artık paylaşılan
// TopicTestModalContent'te (bkz. app/src/components/QuizModalContent.tsx) — soru bankasının
// kendi @modal'ı da (app/soru-bankasi/@modal/...) aynı fonksiyonu, sadece farklı bir
// exitHref ile çağırıyor. Doğrudan bu URL'e girilirse (yenileme, dışarıdan link) Next.js bu
// route'u değil, gerçek page.tsx'i render eder.

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

export default async function TopicTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  return <TopicTestModalContent gradeSlug={gradeSlug} lessonSlug={lessonSlug} unitSlug={unitSlug} topicSlug={topicSlug} />;
}
