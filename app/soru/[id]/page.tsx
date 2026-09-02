// app/soru/[id]/page.tsx
// "Soruyu Paylaş" butonunun hedefi: tek bir sorunun HERKESE AÇIK, sabit linki. Testlerdeki
// gibi kişiye özel/rastgele soru seçimi burada yok — paylaşılan kişi her zaman TAM OLARAK
// bu soruyu görür (bkz. kullanıcıyla 2026-09-02 tartışması).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { getPublicQuestionContext } from '@/app/src/lib/publicQuestion';
import { getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import PublicQuestionClient from '@/app/src/components/PublicQuestionClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadData(idParam: string) {
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) return null;

  const context = await getPublicQuestionContext(id);
  if (!context) return null;

  const [question] = await getQuestionsByIds([id]);
  if (!question) return null;

  return { context, question };
}

export default async function PublicQuestionPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadData(id);
  if (!data) notFound();

  return <PublicQuestionClient question={data.question} context={data.context} />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await loadData(id);
  if (!data) return { title: 'Soru Bulunamadı' };

  const { context, question } = data;
  const title = `${context.topicTitle} — Soru | ${context.gradeName} ${context.lessonName}`;
  const description =
    question.type === 'matching'
      ? `${context.topicTitle} konusundan bir eşleştirme sorusu — çöz ve açıklamasını gör.`
      : question.question_text.replace(/\s+/g, ' ').trim().slice(0, 150);
  const canonicalUrl = `${SITE_URL}/soru/${context.questionId}`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}
