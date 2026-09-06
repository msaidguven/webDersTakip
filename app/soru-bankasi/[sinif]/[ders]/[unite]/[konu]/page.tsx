// app/soru-bankasi/[sinif]/[ders]/[unite]/[konu]/page.tsx
// Bir konunun TÜM sorularını tek, statik sayfada cevap anahtarı formatında listeler
// (eski tekil /soru/[id] paylaşım sayfasının yerini alıyor, bkz. app/soru/[id]/page.tsx —
// artık oraya 301 ile yönlendiriyor). ?soru=ID parametresi o soruya scroll+highlight yapar;
// artık SUNUCUDA değil client'ta (QuestionBankHighlight, Suspense'e alınmış) okunuyor —
// searchParams okumak bu sayfayı ISR cache'inden çıkarırdı (bkz. [gradeSlug]/[lessonSlug]/
// page.tsx'teki ?hafta= için aynı çözüm). Bunun bilinçli bedeli: OG/paylaşım kartı artık
// ?soru= değerine göre özelleşmiyor, her zaman genel konu bilgisini gösteriyor — zaten
// <link rel="canonical"> HER ZAMAN parametresiz taban URL'e işaret ediyordu (Google onlarca
// ?soru= varyasyonunu tek sayfa sayıp birleştirsin diye), yani SEO açısından bir kayıp yok.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SITE_URL } from '@/app/src/lib/site';
import { getAllTopicQuestions, getQuestionCommentCounts } from '@/app/src/lib/quizQuestions';
import { getTopicTestPageData, buildTopicPath, buildQuestionBankPath, type TopicTestPageData } from '@/app/src/lib/quizPageData';
import { getSoruBankasiUnitData, buildSoruBankasiGradePath, buildSoruBankasiLessonPath, buildSoruBankasiUnitPath } from '@/app/src/lib/soruBankasiPageData';
import QuestionBankHighlight from '@/app/src/components/QuestionBankHighlight';
import QuestionBankBoard from '@/app/src/components/QuestionBankBoard';
import TestStatusCard from '@/app/src/components/TestStatusCard';
import SoruBankasiBrowseSection from '@/app/src/components/SoruBankasiBrowseSection';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Taslak/admin önizlemesi göstermiyor (getTopicTestPageData artık her zaman public +
// soru>0 filtreli), bu yüzden ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki
// aynı desen (generateStaticParams boş bile olsa bu projede revalidate'in çalışması için
// gerekli).
export const revalidate = 3600;

interface Params {
  sinif: string;
  ders: string;
  unite: string;
  konu: string;
}

interface PageProps {
  params: Promise<Params>;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

function buildBreadcrumbJsonLd(data: TopicTestPageData) {
  const path = buildQuestionBankPath(data);
  // Ünite seviyesi eksikti (Sınıf -> Ders -> Konu, arada Ünite atlanıyordu) — kullanıcının
  // 2026-09-06 SEO denetiminde istediği tam hiyerarşi: Sınıf -> Ders -> Ünite -> Konu.
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.unitTitle, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}` },
      { '@type': 'ListItem', position: 5, name: data.topicTitle, item: `${SITE_URL}${buildTopicPath(data)}` },
      { '@type': 'ListItem', position: 6, name: `${data.topicTitle} Soru Bankası`, item: `${SITE_URL}${path}` },
    ],
  };
}

export default async function QuestionBankPage({ params }: PageProps) {
  const { sinif, ders, unite, konu } = await params;
  const data = await getTopicTestPageData(sinif, ders, unite, konu);
  if (!data) notFound();

  const questions = await getAllTopicQuestions(data.topicId);
  const commentCounts = await getQuestionCommentCounts(questions.map((q) => q.id));
  const unitData = await getSoruBankasiUnitData(sinif, ders, unite);
  const unitPath = unitData ? buildSoruBankasiUnitPath(unitData.gradeSlug, unitData.lessonSlug, unitData.unitSlug) : null;

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
          bkz. QuizClient.tsx) kullanılarak varsayılan gizleniyor; tek soru modunda (bkz.
          QuestionBankBoard.tsx) aktif olmayan sorular da display:none ile gizleniyor
          (.question-bank-item). JS kapalıyken bu override devreye girer ve her şey (SEO
          içeriği zaten DOM'da tam olsa da) görsel olarak da açık görünür — progressive
          enhancement. */}
      <noscript>
        <style>{`.cevap-aciklama{grid-template-rows:1fr!important;opacity:1!important;margin-top:0.625rem!important}.cevap-marker{max-width:none!important;opacity:1!important}.question-bank-item{display:block!important}`}</style>
      </noscript>
      <Suspense fallback={null}>
        <QuestionBankHighlight />
      </Suspense>

      {/* Geri linki artık konu içeriğine (buildTopicPath) değil, bir üst seviyeye — ünitenin
          soru bankası sayfasına gidiyor (kullanıcının 2026-09-06 isteği). unitPath yoksa
          (nadir, unitData çekilemediyse) konu içeriğine dönmeye devam eder. */}
      <Link href={unitPath ?? buildTopicPath(data)} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> {unitPath ? `${data.unitTitle} Soru Bankası` : `${data.topicTitle}'a Dön`}
      </Link>

      {data.heroImageUrl && (
        <div className="mb-4 overflow-hidden rounded-2xl sm:mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.heroImageUrl} alt={data.topicTitle} className="h-32 w-full object-cover sm:h-44" />
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        {/* Sınıf/Ders/Ünite artık düz metin değil, gerçek link — hem görünür breadcrumb hem
            iç linkleme (kullanıcının 2026-09-06 SEO denetimi isteği: "breadcrumb linkleri
            çalışmalı", "iç linkleme"). Aynı görsel stil korunuyor, sadece <p> yerine
            tıklanabilir segmentler. */}
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          <Link href={buildSoruBankasiGradePath(sinif)} className="hover:underline">
            {data.gradeName}
          </Link>{' '}
          •{' '}
          <Link href={buildSoruBankasiLessonPath(sinif, ders)} className="hover:underline">
            {data.lessonName}
          </Link>{' '}
          •{' '}
          {unitPath ? (
            <Link href={unitPath} className="hover:underline">
              {data.unitTitle}
            </Link>
          ) : (
            data.unitTitle
          )}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.topicTitle} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">{questions.length} soru — cevap anahtarıyla birlikte</p>
      </div>

      {/* Aşağıdaki liste inceleme amaçlı (cevap anahtarıyla, puansız); asıl puanlı test
          (Konu Kavrama Testi) aynı sayfada, URL hiç değişmeden, saf client-side modal
          olarak başlatılıyor — bkz. TestStatusCard.tsx. Slug'lar data.* yerine route
          param'larından (sinif/ders/unite/konu) veriliyor — TopicTestPageData'daki
          gradeSlug/lessonSlug/unitSlug/topicSlug DB'den nullable geliyor, bu URL
          param'ları zaten garanti non-null string. */}
      {questions.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <TestStatusCard
            scope="topic"
            gradeSlug={sinif}
            lessonSlug={ders}
            unitSlug={unite}
            topicSlug={konu}
            topicId={data.topicId}
            unitId={data.unitId}
            title="Kavrama Testi"
            color="indigo"
          />
        </div>
      )}

      {/* Giriş yapmamış kullanıcı direkt 100 soruyu görsün (varsayılan açık); giriş
          yapmışsa yukarıdaki kişiselleştirilmiş 10 soruluk test öne çıksın diye bu bölüm
          kapalı başlasın — SEO'ya etkisi yok, sunucu render'ı her zaman açık/tam, sadece
          mount sonrası client'ta (giriş durumu öğrenilince) kapatılıyor. Bkz.
          SoruBankasiBrowseSection.tsx. */}
      <SoruBankasiBrowseSection questionCount={questions.length}>
        <QuestionBankBoard
          questions={questions}
          basePath={buildQuestionBankPath(data)}
          gradeId={data.gradeId}
          lessonId={data.lessonId}
          unitId={data.unitId}
          commentCounts={commentCounts}
        />
      </SoruBankasiBrowseSection>

      {/* Alt/ders/sınıf soru bankası hub'larına link HER ZAMAN gösteriliyor (kullanıcının
          2026-09-06 SEO denetimi isteği: iç linkleme) — eskiden bu ünitenin birden fazla
          konusu yoksa tüm blok (hub linkleri dahil) gizleniyordu, tek konulu ünitelerde
          sayfanın yukarı hiyerarşiye giden tek yolu üstteki geri linki kalıyordu. Konu
          "pill"leri hâlâ sadece >1 konu varken anlamlı olduğu için o kısım koşullu kalıyor. */}
      {unitData && unitPath && (
        <div className="mt-6 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mt-8 sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{unitData.unitTitle}</p>
          {unitData.topics.length > 1 && (
            <>
              <h2 className="mt-1 text-sm font-black text-default">Bu Ünitedeki Diğer Konular</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {unitData.topics.map((topic) =>
                  topic.slug === data.topicSlug ? (
                    <span key={topic.slug} className="rounded-full border border-indigo-400/60 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-500">
                      {topic.title}
                    </span>
                  ) : (
                    <Link
                      key={topic.slug}
                      href={`${unitPath}/${topic.slug}`}
                      className="rounded-full border border-default bg-surface px-3 py-1.5 text-xs font-bold text-default transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
                    >
                      {topic.title}
                    </Link>
                  )
                )}
              </div>
            </>
          )}
          <div className={`flex flex-col gap-1.5 text-xs font-bold ${unitData.topics.length > 1 ? 'mt-4 border-t border-default pt-3' : 'mt-3'}`}>
            <Link href={buildSoruBankasiLessonPath(unitData.gradeSlug, unitData.lessonSlug)} className="text-muted-foreground transition-colors hover:text-indigo-500">
              → Tüm {unitData.lessonName} Soru Bankaları
            </Link>
            <Link href={buildSoruBankasiGradePath(unitData.gradeSlug)} className="text-muted-foreground transition-colors hover:text-indigo-500">
              → Tüm {unitData.gradeName} Soru Bankaları
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sinif, ders, unite, konu } = await params;
  const data = await getTopicTestPageData(sinif, ders, unite, konu);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildQuestionBankPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;

  const title = `${data.topicTitle} - ${data.gradeName} ${data.lessonName} Soru Bankası`;
  const description = `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusuna ait ${data.questionCount} soru ve cevap anahtarını tek sayfada incele.`;

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
      url: canonicalUrl,
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
