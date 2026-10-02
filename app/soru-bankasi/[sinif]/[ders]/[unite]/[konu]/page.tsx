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
import { getTopicPageBaseData, buildTopicPath, buildQuestionBankPath, type TopicTestPageData } from '@/app/src/lib/quizPageData';
import type { SoruBankasiUnitData } from '@/app/src/lib/soruBankasiPageData';
import {
  getSoruBankasiUnitData,
  getSoruBankasiGradeData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiUnitPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';
import QuestionBankHighlight from '@/app/src/components/QuestionBankHighlight';
import QuestionBankBoard from '@/app/src/components/QuestionBankBoard';
import TestStatusCard from '@/app/src/components/TestStatusCard';
import GuestTestCover from '@/app/src/components/questionPlayer/GuestTestCover';
import SoruBankasiBrowseSection from '@/app/src/components/SoruBankasiBrowseSection';
import Link from 'next/link';
import { BookOpen, ClipboardList } from 'lucide-react';

// Taslak/admin önizlemesi göstermiyor (getTopicTestPageData artık her zaman public +
// soru>0 filtreli), bu yüzden ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki
// aynı desen (generateStaticParams boş bile olsa bu projede revalidate'in çalışması için
// gerekli).
// Günlük fallback (2026-10-02, Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
export const revalidate = 86400;

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

// Görünür breadcrumb ile BİREBİR aynı hiyerarşi (soru bankası sayfaları) — eskiden JSON-LD
// konu anlatımı sayfalarını (/[sinif]/[ders]/...) işaret ediyordu, görünür yol ise
// /soru-bankasi/... idi; Google iki farklı hiyerarşi görüyordu (2026-09-26 SEO temizliği).
// Diğer soru bankası seviyeleriyle aynı yardımcı (buildSoruBankasiBreadcrumbJsonLd).
function buildBreadcrumbJsonLd(data: TopicTestPageData, sinif: string, ders: string, unite: string) {
  return buildSoruBankasiBreadcrumbJsonLd([
    { name: `${data.gradeName} Soru Bankası`, path: buildSoruBankasiGradePath(sinif) },
    { name: `${data.lessonName} Soru Bankası`, path: buildSoruBankasiLessonPath(sinif, ders) },
    { name: `${data.unitTitle} Soru Bankası`, path: buildSoruBankasiUnitPath(sinif, ders, unite) },
    { name: `${data.topicTitle} Soru Bankası`, path: buildQuestionBankPath(data) },
  ]);
}

export default async function QuestionBankPage({ params }: PageProps) {
  const { sinif, ders, unite, konu } = await params;
  const data = await getTopicPageBaseData(sinif, ders, unite, konu);
  if (!data) notFound();

  if (data.questionCount === 0) {
    const unitData = await getSoruBankasiUnitData(sinif, ders, unite);
    return <EmptyTopicQuestionBank data={data} unitData={unitData} sinif={sinif} ders={ders} unite={unite} />;
  }

  const questions = await getAllTopicQuestions(data.topicId);
  const commentCounts = await getQuestionCommentCounts(questions.map((q) => q.id));
  const unitData = await getSoruBankasiUnitData(sinif, ders, unite);
  const unitPath = unitData ? buildSoruBankasiUnitPath(unitData.gradeSlug, unitData.lessonSlug, unitData.unitSlug) : null;
  const gradeData = await getSoruBankasiGradeData(sinif);
  const otherLessons = (gradeData?.lessons || []).filter((l) => l.slug !== ders);

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-question-bank-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data, sinif, ders, unite)).replace(/</g, '\\u003c'),
        }}
      />
      {/* Cevap/açıklama blokları JS ile CSS collapse (.cevap-aciklama / .cevap-marker,
          bkz. QuizClient.tsx) kullanılarak varsayılan gizleniyor; tek soru modunda (bkz.
          QuestionBankBoard.tsx) aktif olmayan sorular da display:none ile gizleniyor
          (.question-bank-item). JS kapalıyken bu override devreye girer ve her şey (SEO
          içeriği zaten DOM'da tam olsa da) görsel olarak da açık görünür — progressive
          enhancement. */}
      <noscript>
        <style>{`.cevap-aciklama{grid-template-rows:1fr!important;opacity:1!important;margin-top:0.625rem!important}.cevap-marker{max-width:none!important;opacity:1!important}.question-bank-item{display:block!important}#soru-bankasi-listesi{display:block!important}`}</style>
      </noscript>
      <Suspense fallback={null}>
        <QuestionBankHighlight />
      </Suspense>

      {/* Sade başlık (2026-09-26): banner görseli, ayrı "← geri" linki ve büyük harfli yol
          satırı kaldırıldı — üçü de aynı işi (nerede olduğunu göstermek) farklı biçimde
          yapıyordu. Tek, küçük bir breadcrumb hem geri dönüşü hem iç linklemeyi karşılıyor;
          JSON-LD breadcrumb ile birebir aynı hiyerarşi. Görsel og:image olarak kullanılmaya
          devam ediyor (bkz. generateMetadata). */}
      <nav aria-label="Konum" className="mb-3 sm:mb-4">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-muted-foreground">
          <li>
            <Link href={buildSoruBankasiGradePath(sinif)} className="transition-colors hover:text-indigo-500">
              {data.gradeName}
            </Link>
          </li>
          <li aria-hidden className="opacity-50">/</li>
          <li>
            <Link href={buildSoruBankasiLessonPath(sinif, ders)} className="transition-colors hover:text-indigo-500">
              {data.lessonName}
            </Link>
          </li>
          <li aria-hidden className="opacity-50">/</li>
          <li className="min-w-0">
            <Link href={unitPath ?? buildSoruBankasiUnitPath(sinif, ders, unite)} className="transition-colors hover:text-indigo-500">
              {data.unitTitle}
            </Link>
          </li>
        </ol>
      </nav>

      <header className="mb-5 sm:mb-7">
        <h1 className="text-2xl font-black leading-tight tracking-tight text-default sm:text-3xl">
          {data.topicTitle} <span className="text-indigo-500">Soru Bankası</span>
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-600 dark:text-indigo-300">
            {questions.length} soru · cevap anahtarlı
          </span>
          {/* Konu anlatımı ↔ soru bankası karşılıklı iç linki (SEO kümesi). */}
          {data.hasPublishedContent && (
            <Link
              href={buildTopicPath(data)}
              className="inline-flex items-center gap-1.5 rounded-full border border-default px-2.5 py-1 text-default transition-colors hover:border-indigo-400/60 hover:text-indigo-500"
            >
              <BookOpen className="h-3.5 w-3.5" /> Konu anlatımı
            </Link>
          )}
        </div>

        {/* Kazanım: her soru bankası sayfasını kendine özgü kılan metin (SEO). */}
        {data.learningOutcome && (
          <p className="mt-3 border-l-2 border-indigo-500/40 pl-3 text-sm text-muted-foreground">
            <span className="font-bold text-default">Kazanım:</span> {data.learningOutcome}
          </p>
        )}
      </header>

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
            guestContent={
              <GuestTestCover
                topicId={data.topicId}
                topicTitle={data.topicTitle}
                eyebrowText={`${data.gradeName} · ${data.lessonName} · ${data.topicTitle}`}
                questionCount={questions.length}
              />
            }
          />
        </div>
      )}

      {/* Herkeste kapalı başlar (?soru= paylaşım linkinde ve kapaktaki "incele" ile açılır) —
          sorular yine de sunucu HTML'inde tam; bkz. SoruBankasiBrowseSection.tsx. */}
      <SoruBankasiBrowseSection questionCount={questions.length} questionIds={questions.map((q) => q.id)}>
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
          2026-09-06 SEO denetimi isteği: iç linkleme). "Bu Ünitedeki Diğer Konular" pilleri
          (aynı ünite içi, düşük SEO değeri — bu sayfadan zaten geri linkiyle 1 tıkla ünite
          sayfasına gidip TÜM konuları görebiliyorsun) yerine SINIFIN DİĞER DERSLERİNE
          doğrudan link konuldu (kullanıcının 2026-09-10 isteği) — Tüm X Soru Bankaları
          linkleri zaten dolaylı (2 tık) aynı yere gidiyordu, bu iç link mesafesini 1 tıka
          indirip site genelinde ders sayfaları arası SEO linklemesini güçlendiriyor. */}
      {unitData && unitPath && (
        <div className="mt-6 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mt-8 sm:p-6">
          <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{unitData.gradeName}</p>
          {otherLessons.length > 0 && (
            <>
              <h2 className="mt-1 text-sm font-black text-default">Bu Sınıftaki Diğer Dersler</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {otherLessons.map((lesson) => (
                  <Link
                    key={lesson.slug}
                    href={buildSoruBankasiLessonPath(unitData.gradeSlug, lesson.slug)}
                    className="rounded-full border border-default bg-surface px-3 py-1.5 text-xs font-bold text-default transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
                  >
                    {lesson.icon} {lesson.name}
                  </Link>
                ))}
              </div>
            </>
          )}
          <div className={`flex flex-col gap-1.5 text-xs font-bold ${otherLessons.length > 0 ? 'mt-4 border-t border-default pt-3' : 'mt-3'}`}>
            <Link href={unitPath} className="text-muted-foreground transition-colors hover:text-indigo-500">
              → {unitData.unitTitle} — Tüm Konular
            </Link>
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
  const data = await getTopicPageBaseData(sinif, ders, unite, konu);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildQuestionBankPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;

  // Sorusu olmayan konu: sayfa kullanıcıya açık ama Google'a kapalı (boş/ince sayfa
  // indekslenirse site kalitesini düşürür). Soru eklenince (sayfa tazelenince) otomatik
  // indekslenebilir hale gelir; sitemap de aynı soru>0 tanımını kullanıyor.
  if (!data.hasQuestions) {
    return {
      title: `${data.topicTitle} - ${data.gradeName} ${data.lessonName} Soru Bankası`,
      description: `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusuna henüz soru eklenmedi.`,
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = `${data.topicTitle} - ${data.gradeName} ${data.lessonName} Soru Bankası`;
  const description = data.learningOutcome
    ? `${data.gradeName} ${data.lessonName} ${data.topicTitle}: ${data.questionCount} soru ve cevap anahtarı. Kazanım: ${data.learningOutcome}.`
    : `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusuna ait ${data.questionCount} soru ve cevap anahtarını tek sayfada incele.`;
  // Konunun kendi kapak görseli varsa paylaşım kartında o görünsün (WhatsApp/sosyal medya).
  const ogImage = data.heroImageUrl
    ? { url: data.heroImageUrl, alt: data.topicTitle }
    : { url: '/og-image.png', width: 1200, height: 630 };

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
      images: [ogImage],
    },
    twitter: {
      card: data.heroImageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
    },
  };
}

// Konu var ama henüz sorusu yok: 404 yerine yönlendiren bir sayfa (noindex, bkz. generateMetadata).
function EmptyTopicQuestionBank({
  data,
  unitData,
  sinif,
  ders,
  unite,
}: {
  data: TopicTestPageData;
  unitData: SoruBankasiUnitData | null;
  sinif: string;
  ders: string;
  unite: string;
}) {
  const unitPath = buildSoruBankasiUnitPath(sinif, ders, unite);
  const otherTopics = (unitData?.topics ?? []).filter((t) => t.id !== data.topicId);
  // Ünitede hiç soru yoksa ünite hub'ı da boş/404 — o zaman dersin soru bankasına yönlendir.
  const fallbackHref = otherTopics.length > 0 ? unitPath : buildSoruBankasiLessonPath(sinif, ders);
  const fallbackLabel = otherTopics.length > 0 ? `${data.unitTitle} soru bankası` : `Tüm ${data.lessonName} soru bankaları`;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <nav aria-label="Konum" className="mb-3 sm:mb-4">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold text-muted-foreground">
          <li>
            <Link href={buildSoruBankasiGradePath(sinif)} className="transition-colors hover:text-indigo-500">{data.gradeName}</Link>
          </li>
          <li aria-hidden className="opacity-50">/</li>
          <li>
            <Link href={buildSoruBankasiLessonPath(sinif, ders)} className="transition-colors hover:text-indigo-500">{data.lessonName}</Link>
          </li>
          <li aria-hidden className="opacity-50">/</li>
          <li className="min-w-0">
            <Link href={unitPath} className="transition-colors hover:text-indigo-500">{data.unitTitle}</Link>
          </li>
        </ol>
      </nav>

      <h1 className="text-2xl font-black leading-tight tracking-tight text-default sm:text-3xl">
        {data.topicTitle} <span className="text-indigo-500">Soru Bankası</span>
      </h1>

      <div className="mt-5 rounded-2xl border border-default bg-surface-elevated p-5 text-center sm:p-8">
        <ClipboardList className="mx-auto h-10 w-10 text-indigo-500/70" aria-hidden="true" />
        <p className="mt-3 text-base font-black text-default">Bu konuya henüz soru eklenmedi</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sorular hazırlanıyor.{data.hasPublishedContent ? ' O zamana kadar konu anlatımını inceleyebilirsin.' : ''}
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {data.hasPublishedContent && (
            <Link
              href={buildTopicPath(data)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-600"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Konu anlatımına git
            </Link>
          )}
          <Link
            href={fallbackHref}
            className="inline-flex items-center rounded-xl border border-default px-4 py-2.5 text-sm font-bold text-default transition-colors hover:border-indigo-400/60 hover:text-indigo-500"
          >
            {fallbackLabel}
          </Link>
        </div>
      </div>

      {otherTopics.length > 0 && (
        <section className="mt-6 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:p-6">
          <h2 className="text-sm font-black text-default">Bu ünitede sorusu olan konular</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {otherTopics.map((t) => (
              <li key={t.id}>
                <Link
                  href={`${unitPath}/${t.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-default bg-surface px-3 py-2 text-sm font-bold text-default transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
                >
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t.questionCount} soru</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
