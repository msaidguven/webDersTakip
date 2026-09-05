// app/soru-bankasi/[sinif]/[ders]/[unite]/page.tsx
// /soru-bankasi hiyerarşisinde ünite seviyesi — SON SAYFA burası (kullanıcının 2026-09-05
// isteği: "son sayfa ünite olsa, konular orada olmasa"). Konular artık ayrı bir sayfaya
// GİTMİYOR, bu sayfada açılıp kapanan bir accordion (bkz. SoruBankasiUnitAccordion.tsx) —
// tıklanan konunun soruları lazy fetch ile geliyor, tek seferde ünitedeki tüm sorular
// (bazı ünitelerde 180'e kadar) render edilmiyor. Konunun kendi sayfası ([konu]/page.tsx)
// SEO/paylaşım linki olarak hâlâ yaşıyor, sadece buradan artık link verilmiyor.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL } from '@/app/src/lib/site';
import {
  getSoruBankasiUnitData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiUnitPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';
import SoruBankasiUnitAccordion from '@/app/src/components/SoruBankasiUnitAccordion';
import TestStatusCard from '@/app/src/components/TestStatusCard';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
export const revalidate = 3600;

interface Params {
  sinif: string;
  ders: string;
  unite: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export default async function SoruBankasiUnitPage({ params }: { params: Promise<Params> }) {
  const { sinif, ders, unite } = await params;
  const data = await getSoruBankasiUnitData(sinif, ders, unite);
  if (!data) notFound();

  const gradePath = buildSoruBankasiGradePath(data.gradeSlug);
  const lessonPath = buildSoruBankasiLessonPath(data.gradeSlug, data.lessonSlug);
  const path = buildSoruBankasiUnitPath(data.gradeSlug, data.lessonSlug, data.unitSlug);

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-soru-bankasi-unit-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildSoruBankasiBreadcrumbJsonLd([
              { name: `${data.gradeName} Soru Bankası`, path: gradePath },
              { name: `${data.lessonName} Soru Bankası`, path: lessonPath },
              { name: `${data.unitTitle} Soru Bankası`, path },
            ])
          ).replace(/</g, '\\u003c'),
        }}
      />

      <Link href={lessonPath} className="mb-2 inline-block text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        ← {data.lessonName} Soru Bankası
      </Link>

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          {data.gradeName} • {data.lessonName}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.unitTitle} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Bir konuyu aç, cevap anahtarlı sorularını incele.</p>
      </div>

      {!data.hasQuestions && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu ünitede henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}

      {/* Soru bankası inceleme amaçlı (cevap anahtarıyla, puansız); asıl puanlı test de
          aynı sayfadan (modal olarak, bkz. app/soru-bankasi/@modal) başlatılıyor — kartın
          durumu (Teste Başla / Devam Et + istatistik) client'ta ayrıca çekiliyor, bkz.
          TestStatusCard.tsx (bkz. [[feedback_information_architecture_discipline]]). */}
      {data.hasQuestions && (
        <div className="mb-4 sm:mb-6">
          <TestStatusCard
            scope="unit"
            unitId={data.unitId}
            testHref={`/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/unite-testi`}
            title="Ünite Testi"
            color="emerald"
          />
        </div>
      )}

      {data.topics.length > 0 ? (
        <SoruBankasiUnitAccordion
          topics={data.topics}
          gradeSlug={data.gradeSlug}
          lessonSlug={data.lessonSlug}
          unitSlug={data.unitSlug}
          gradeId={data.gradeId}
          lessonId={data.lessonId}
          unitId={data.unitId}
        />
      ) : (
        <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu ünitede henüz konu eklenmemiş.</p>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif, ders, unite } = await params;
  const data = await getSoruBankasiUnitData(sinif, ders, unite);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildSoruBankasiUnitPath(data.gradeSlug, data.lessonSlug, data.unitSlug);
  const canonicalUrl = `${SITE_URL}${path}`;
  const topicNames = data.topics.map((t) => t.title).join(', ');
  const title = `${data.unitTitle} Soru Bankası - ${data.gradeName} ${data.lessonName}`;
  const description = topicNames
    ? `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesinde ${topicNames} konularında cevap anahtarlı, ücretsiz soru bankaları.`
    : `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi için cevap anahtarlı, ücretsiz soru bankaları.`;

  return {
    title,
    description,
    robots: {
      index: data.hasQuestions,
      follow: data.hasQuestions,
      googleBot: { index: data.hasQuestions, follow: data.hasQuestions, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
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
    twitter: { card: 'summary', title, description },
  };
}
