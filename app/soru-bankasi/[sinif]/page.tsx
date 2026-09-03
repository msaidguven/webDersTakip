// app/soru-bankasi/[sinif]/page.tsx
// /soru-bankasi hiyerarşisinin en üst (sınıf) seviyesi — o sınıftaki dersleri, her birinin
// soru sayısıyla birlikte listeler. Aşağı seviyeler: [ders]/page.tsx (üniteler),
// [ders]/[unite]/page.tsx (konular), [ders]/[unite]/[konu]/page.tsx (asıl soru bankası).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getSoruBankasiGradeData, buildSoruBankasiGradePath, buildSoruBankasiLessonPath, buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  sinif: string;
}

export default async function SoruBankasiGradePage({ params }: { params: Promise<Params> }) {
  const { sinif } = await params;
  const data = await getSoruBankasiGradeData(sinif);
  if (!data) notFound();

  const path = buildSoruBankasiGradePath(data.gradeSlug);

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-soru-bankasi-grade-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSoruBankasiBreadcrumbJsonLd([{ name: `${data.gradeName} Soru Bankası`, path }])).replace(/</g, '\\u003c'),
        }}
      />

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Soru Bankası</p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.gradeName} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Bir ders seç, cevap anahtarlı soru bankasına ulaş.</p>
      </div>

      {!data.hasQuestions && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu sınıfta henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}

      <div className="space-y-2.5">
        {data.lessons.map((lesson) => (
          <Link
            key={lesson.slug}
            href={buildSoruBankasiLessonPath(data.gradeSlug, lesson.slug)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-default">{lesson.name}</p>
              {lesson.questionCount === 0 ? (
                <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-500">Taslak</span>
              ) : (
                <span className="mt-1 inline-block text-xs font-bold text-muted-foreground">{lesson.questionCount} soru</span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {data.lessons.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu sınıfta henüz ders eklenmemiş.</p>}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif } = await params;
  const data = await getSoruBankasiGradeData(sinif);
  if (!data) return { title: 'Soru Bankası Bulunamadı' };

  const path = buildSoruBankasiGradePath(data.gradeSlug);
  const canonicalUrl = `${SITE_URL}${path}`;
  const lessonNames = data.lessons.map((l) => l.name).join(', ');
  const title = `${data.gradeName} Soru Bankası - Tüm Dersler`;
  const description = lessonNames
    ? `${data.gradeName} için ${lessonNames} derslerinde cevap anahtarlı, ücretsiz soru bankaları.`
    : `${data.gradeName} için cevap anahtarlı, ücretsiz soru bankaları.`;

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
