// app/soru-bankasi/[sinif]/[ders]/page.tsx
// /soru-bankasi hiyerarşisinde ders seviyesi — o sınıf+dersteki üniteleri, her birinin
// konu/soru sayısıyla birlikte listeler.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import {
  getSoruBankasiLessonData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiUnitPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
export const revalidate = 3600;

interface Params {
  sinif: string;
  ders: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export default async function SoruBankasiLessonPage({ params }: { params: Promise<Params> }) {
  const { sinif, ders } = await params;
  const data = await getSoruBankasiLessonData(sinif, ders);
  if (!data) notFound();

  const gradePath = buildSoruBankasiGradePath(data.gradeSlug);
  const path = buildSoruBankasiLessonPath(data.gradeSlug, data.lessonSlug);

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-soru-bankasi-lesson-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildSoruBankasiBreadcrumbJsonLd([
              { name: `${data.gradeName} Soru Bankası`, path: gradePath },
              { name: `${data.lessonName} Soru Bankası`, path },
            ])
          ).replace(/</g, '\\u003c'),
        }}
      />

      <Link href={gradePath} className="mb-2 inline-block text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        ← {data.gradeName} Soru Bankası
      </Link>

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{data.gradeName}</p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.lessonName} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Bir ünite seç, cevap anahtarlı soru bankasına ulaş.</p>
      </div>

      {!data.hasQuestions && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu derste henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}

      <div className="space-y-2.5">
        {data.units.map((unit) => (
          <Link
            key={unit.slug}
            href={buildSoruBankasiUnitPath(data.gradeSlug, data.lessonSlug, unit.slug)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-default">{unit.title}</p>
              {unit.questionCount === 0 ? (
                <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-500">Taslak</span>
              ) : (
                <span className="mt-1 inline-block text-xs font-bold text-muted-foreground">
                  {unit.topicCount} konu • {unit.questionCount} soru
                </span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {data.units.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu derste henüz ünite eklenmemiş.</p>}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif, ders } = await params;
  const data = await getSoruBankasiLessonData(sinif, ders);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildSoruBankasiLessonPath(data.gradeSlug, data.lessonSlug);
  const canonicalUrl = `${SITE_URL}${path}`;
  const unitNames = data.units.map((u) => u.title).join(', ');
  const title = `${data.lessonName} Soru Bankası - ${data.gradeName}`;
  const description = unitNames
    ? `${data.gradeName} ${data.lessonName} dersinde ${unitNames} ünitelerinde cevap anahtarlı, ücretsiz soru bankaları.`
    : `${data.gradeName} ${data.lessonName} dersi için cevap anahtarlı, ücretsiz soru bankaları.`;

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
