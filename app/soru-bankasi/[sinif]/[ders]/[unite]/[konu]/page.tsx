// app/soru-bankasi/[sinif]/[ders]/[unite]/[konu]/page.tsx
// Bir konunun TÜM sorularını tek, statik sayfada cevap anahtarı formatında listeler
// (eski tekil /soru/[id] paylaşım sayfasının yerini alıyor, bkz. app/soru/[id]/page.tsx —
// artık oraya 301 ile yönlendiriyor). ?soru=ID parametresi o soruya scroll+highlight yapar
// ve sadece OG meta'yı o soruya özel üretir; <link rel="canonical"> HER ZAMAN parametresiz
// taban URL'e işaret eder ki Google onlarca ?soru= varyasyonunu tek sayfa sayıp
// birleştirsin (index bloat oluşmasın).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { getAllTopicQuestions, getQuestionsByIds } from '@/app/src/lib/quizQuestions';
import { getTopicTestPageData, buildTopicPath, buildQuestionBankPath, type TopicTestPageData } from '@/app/src/lib/quizPageData';
import QuestionBankHighlight from '@/app/src/components/QuestionBankHighlight';
import QuestionBankBoard from '@/app/src/components/QuestionBankBoard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  sinif: string;
  ders: string;
  unite: string;
  konu: string;
}

interface PageProps {
  params: Promise<Params>;
  searchParams: Promise<{ soru?: string }>;
}

function buildBreadcrumbJsonLd(data: TopicTestPageData) {
  const path = buildQuestionBankPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.topicTitle, item: `${SITE_URL}${buildTopicPath(data)}` },
      { '@type': 'ListItem', position: 5, name: `${data.topicTitle} Soru Bankası`, item: `${SITE_URL}${path}` },
    ],
  };
}

function parseQuestionParam(soru: string | undefined): number | null {
  if (!soru) return null;
  const id = Number(soru);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default async function QuestionBankPage({ params, searchParams }: PageProps) {
  const { sinif, ders, unite, konu } = await params;
  const { soru } = await searchParams;
  const data = await getTopicTestPageData(sinif, ders, unite, konu);
  if (!data) notFound();

  const questions = await getAllTopicQuestions(data.topicId);
  const activeId = parseQuestionParam(soru);
  const activeIdOnPage = activeId != null && questions.some((q) => q.id === activeId) ? activeId : null;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-question-bank-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      {/* Cevap/açıklama blokları JS ile CSS collapse (.cevap-aciklama / .cevap-marker,
          bkz. QuizClient.tsx) kullanılarak varsayılan gizleniyor. JS kapalıyken bu override
          devreye girer ve her şey (SEO içeriği zaten DOM'da tam olsa da) görsel olarak da
          açık görünür — progressive enhancement. */}
      <noscript>
        <style>{`.cevap-aciklama{grid-template-rows:1fr!important;opacity:1!important;margin-top:0.625rem!important}.cevap-marker{max-width:none!important;opacity:1!important}`}</style>
      </noscript>
      <QuestionBankHighlight activeQuestionId={activeIdOnPage} />

      {!data.hasQuestions && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu konuda henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}

      <Link href={buildTopicPath(data)} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> {data.topicTitle}&apos;a Dön
      </Link>

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          {data.gradeName} • {data.lessonName} • {data.unitTitle}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.topicTitle} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">{questions.length} soru — cevap anahtarıyla birlikte</p>
      </div>

      <QuestionBankBoard questions={questions} />
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { sinif, ders, unite, konu } = await params;
  const { soru } = await searchParams;
  const data = await getTopicTestPageData(sinif, ders, unite, konu);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildQuestionBankPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;
  const activeId = parseQuestionParam(soru);

  let title = `${data.topicTitle} - ${data.gradeName} ${data.lessonName} Soru Bankası`;
  let description = `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusuna ait ${data.questionCount} soru ve cevap anahtarını tek sayfada incele.`;
  let pageUrl = canonicalUrl;

  if (activeId != null) {
    const [question] = await getQuestionsByIds([activeId]);
    if (question) {
      title = `${data.topicTitle} - Soru ${activeId}`;
      description =
        question.type === 'matching'
          ? `${data.topicTitle} konusundan bir eşleştirme sorusu ve cevap anahtarı.`
          : question.question_text.replace(/\s+/g, ' ').trim().slice(0, 150);
      pageUrl = `${canonicalUrl}?soru=${activeId}`;
    }
  }

  return {
    title,
    description,
    robots: {
      index: data.hasQuestions,
      follow: data.hasQuestions,
      googleBot: {
        index: data.hasQuestions,
        follow: data.hasQuestions,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'Ders Takip',
      locale: 'tr_TR',
      type: 'article',
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
