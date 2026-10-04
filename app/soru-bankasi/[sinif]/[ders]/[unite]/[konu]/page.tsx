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
  getSoruBankasiLessonData,
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
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';

// Taslak/admin önizlemesi göstermiyor (getTopicTestPageData artık her zaman public +
// soru>0 filtreli), bu yüzden ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki
// aynı desen (generateStaticParams boş bile olsa bu projede revalidate'in çalışması için
// gerekli).
// 2026-10-02 günlük fallback'a inmişti (Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
// 7 gün (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı): içerik yayını/soru onayı ilgili sayfayı
// zaten anında yeniler (revalidatePath); haftaya bağlı bölümler (Okulda bu hafta) pazartesi sabahı
// toplu yenilenir — bkz. app/src/lib/scheduledCacheRefresh.ts.
export const revalidate = 604800;

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
  const [gradeData, lessonData] = await Promise.all([getSoruBankasiGradeData(sinif), getSoruBankasiLessonData(sinif, ders)]);

  const intro = buildIntro(data, questions);

  // 2026-10-03 yenilemesi (anasayfa tasarım diliyle aynı): üstte başlık + özgün giriş metni +
  // kazanım (masaüstünde sağda konu görseli); altında soru listesi AÇIK ve test kartı sağ
  // sütunda (mobilde listenin üstünde). Eskiden sorular kapalı bir kutudaydı, sayfanın
  // görünen içeriği yalnız büyük test kartıydı.
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-question-bank-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildBreadcrumbJsonLd(data, sinif, ders, unite)).replace(/</g, '\\u003c'),
          }}
        />
        {/* Cevap/açıklama blokları JS ile CSS collapse (.cevap-aciklama / .cevap-marker, bkz.
            QuizClient.tsx), "Kalan N soru" ile açılanlar display:none (.question-bank-item).
            JS kapalıyken bu override her şeyi açık gösterir — progressive enhancement. */}
        <noscript>
          <style>{`.cevap-aciklama{grid-template-rows:1fr!important;opacity:1!important;margin-top:0.625rem!important}.cevap-marker{max-width:none!important;opacity:1!important}.question-bank-item{display:block!important}`}</style>
        </noscript>
        <Suspense fallback={null}>
          <QuestionBankHighlight />
        </Suspense>

        <SoruBankasiHeader
          crumbs={[
            { name: data.gradeName, href: buildSoruBankasiGradePath(sinif) },
            { name: data.lessonName, href: buildSoruBankasiLessonPath(sinif, ders) },
            { name: data.unitTitle, href: unitPath ?? buildSoruBankasiUnitPath(sinif, ders, unite) },
          ]}
          lessonName={data.lessonName}
          eyebrow={`${data.gradeName} · ${data.lessonName}`}
          title={`${data.topicTitle} Soru Bankası`}
          pills={[`${questions.length} soru`, 'Cevap anahtarlı', 'Açıklamalı', 'Ücretsiz']}
          intro={intro}
          imageUrl={data.heroImageUrl}
          imageAlt={`${data.topicTitle} konu görseli`}
        >
          {/* Kazanım: her soru bankası sayfasını kendine özgü kılan metin (SEO). */}
          {data.learningOutcome && (
            <p className="mt-4 rounded-r-xl border-l-[3px] border-indigo-400/70 bg-background px-4 py-2.5 text-sm text-muted-foreground">
              <span className="font-semibold text-default">Kazanım:</span> {data.learningOutcome}
            </p>
          )}
          {/* Konu anlatımı ↔ soru bankası karşılıklı iç linki (SEO kümesi). */}
          {data.hasPublishedContent && (
            <Link
              href={buildTopicPath(data)}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-default bg-background px-4 text-sm font-semibold text-default transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Konu anlatımını oku
            </Link>
          )}
        </SoruBankasiHeader>

        {/* Mobilde sıra: test kartı → sorular → ilgili linkler; masaüstünde test kartı ve linkler sağ sütunda. */}
        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:gap-x-8">
          <div className="lg:col-start-2 lg:row-start-1">
            <TestStatusCard
              scope="topic"
              gradeSlug={sinif}
              lessonSlug={ders}
              unitSlug={unite}
              topicSlug={konu}
              topicId={data.topicId}
              unitId={data.unitId}
              title="Kendini test et"
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

          <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
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
          </div>

          {/* Hiyerarşi gezinmesi (2026-10-03, kullanıcı isteği): ünitenin TÜM konuları, dersin TÜM
              üniteleri, sınıfın TÜM dersleri — bulunulan yer vurgulu (bkz. SoruBankasiNavList).
              İç linkleme (2026-09-06/09-10 SEO kararları) bununla karşılanıyor. */}
          {unitData && unitPath && (
            <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2" aria-label="Soru bankası gezinmesi">
              <SoruBankasiNavList
                id="unitenin-konulari"
                title={`${unitData.unitTitle} konuları`}
                items={unitData.topics.map((t) => ({
                  key: t.id,
                  href: `${unitPath}/${t.slug}`,
                  label: t.title,
                  eyebrow: `${t.number}. konu`,
                  meta: `${t.questionCount} soru`,
                  imageUrl: t.heroImageUrl,
                  lessonName: data.lessonName,
                  current: t.id === data.topicId,
                  isPage: true,
                }))}
              />
              <SoruBankasiNavList
                id="dersin-uniteleri"
                title={`${unitData.lessonName} üniteleri`}
                items={(lessonData?.units ?? []).map((u) => ({
                  key: u.slug,
                  href: buildSoruBankasiUnitPath(unitData.gradeSlug, unitData.lessonSlug, u.slug),
                  label: u.title,
                  eyebrow: `${u.number}. ünite`,
                  meta: `${u.topics.length} konu · ${u.questionCount} soru`,
                  imageUrl: u.imageUrl,
                  lessonName: data.lessonName,
                  current: u.slug === unitData.unitSlug,
                }))}
              />
              <SoruBankasiNavList
                id="sinifin-dersleri"
                title={`${unitData.gradeName} dersleri`}
                items={(gradeData?.lessons ?? []).map((lesson) => ({
                  key: lesson.slug,
                  href: buildSoruBankasiLessonPath(unitData.gradeSlug, lesson.slug),
                  label: lesson.name,
                  meta: `${lesson.questionCount} soru`,
                  lessonName: lesson.name,
                  current: lesson.slug === unitData.lessonSlug,
                }))}
                footer={
                  <Link href={buildSoruBankasiGradePath(unitData.gradeSlug)} className="text-muted-foreground transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
                    Tüm {unitData.gradeName} soru bankaları →
                  </Link>
                }
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// Her konu sayfasına özgün giriş metni (SEO; elle yazılmaz, veriden türetilir): soru türlerinin
// dağılımıyla birlikte. Kazanım ayrı satırda.
const TYPE_PHRASE: Record<QuizQuestion['type'], string> = {
  multiple_choice: 'çoktan seçmeli',
  blank: 'boşluk doldurma',
  matching: 'eşleştirme',
  classical: 'açık uçlu',
};

function buildIntro(data: TopicTestPageData, questions: QuizQuestion[]): string {
  const counts = new Map<QuizQuestion['type'], number>();
  for (const q of questions) counts.set(q.type, (counts.get(q.type) ?? 0) + 1);
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => `${n} ${TYPE_PHRASE[type]}`);
  const typeText = joinTr(parts);
  return (
    `${data.gradeName} ${data.lessonName} dersinin ${data.topicTitle} konusuna ait ${questions.length} soru: ${typeText} sorusu. ` +
    'Her sorunun doğru cevabı ve kısa açıklaması altında yer alıyor; önce kendin çöz, sonra cevabını kontrol et.'
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
    ? `${data.gradeName} ${data.lessonName} ${data.topicTitle} test soruları: ${data.questionCount} soru ve cevap anahtarı. Kazanım: ${data.learningOutcome}.`
    : `${data.gradeName} ${data.lessonName} ${data.topicTitle} test soruları: ${data.questionCount} soru ve cevap anahtarı tek sayfada.`;
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
