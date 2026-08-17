// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/[sectionSlug]/page.tsx
// Eski alt başlığa özel kavrama testi URL'i artık yok — tek bir konu artık TEK kavrama
// testinde birleşiyor (bkz. ../page.tsx). Buraya gelen (indexlenmiş olabilecek) eski
// bağlantıları kalıcı olarak konunun kavrama testine yönlendiriyoruz.

import { permanentRedirect } from 'next/navigation';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function LegacySectionTestRedirectPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  permanentRedirect(`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/kavrama-testi`);
}
