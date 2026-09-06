// app/[gradeSlug]/[lessonSlug]/[unitSlug]/page.tsx
// Ünite tanıtım sayfası (kullanıcının 2026-09-06 isteği) — ünite kapak görseli + konuların
// başlık/kapak görseli/kısa açıklamasını listeler, her konu kartı gerçek konu sayfasına
// (DersClient) link verir. Bilinçli olarak DersClient'ın sidebar'ını/aktif konu state'ini
// KULLANMIYOR (bkz. unitOverviewPageData.ts) — bu yüzden burada hiçbir ünite/konu "seçili"
// görünmüyor, sadece nötr bir tanıtım/liste sayfası.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getUnitOverviewData } from '@/app/src/lib/unitOverviewPageData';

export const revalidate = 3600;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getUnitOverviewData>>>) {
  const lessonPath = `/${data.gradeSlug}/${data.lessonSlug}`;
  const unitPath = `${lessonPath}/${data.unitSlug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}${lessonPath}` },
      { '@type': 'ListItem', position: 4, name: data.unitTitle, item: `${SITE_URL}${unitPath}` },
    ],
  };
}

export default async function UnitOverviewPage({ params }: { params: Promise<Params> }) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitOverviewData(gradeSlug, lessonSlug, unitSlug);
  if (!data) notFound();

  const lessonPath = `/${data.gradeSlug}/${data.lessonSlug}`;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-unit-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />

      <Link href={lessonPath} className="mb-2 inline-block text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        ← {data.lessonName} Müfredatı
      </Link>

      {data.coverImageUrl && (
        <div className="mb-4 overflow-hidden rounded-2xl sm:mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.coverImageUrl} alt={data.unitTitle} className="h-32 w-full object-cover sm:h-44" />
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          {data.gradeName} • {data.lessonName}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.unitTitle}</h1>
        {data.unitDescription && <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">{data.unitDescription}</p>}
      </div>

      <div className="space-y-2.5">
        {data.topics.map((topic) =>
          topic.hasContent ? (
            <Link
              key={topic.id}
              href={`${lessonPath}/${data.unitSlug}/${topic.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-3 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
                {topic.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={topic.heroImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-default">{topic.title}</p>
                {topic.subtitle && <p className="mt-0.5 line-clamp-2 text-xs font-medium text-muted-foreground">{topic.subtitle}</p>}
              </div>
            </Link>
          ) : (
            <div key={topic.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-default/60 p-3 opacity-60">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-default">{topic.title}</p>
                <span className="mt-1 inline-block text-[10px] font-black uppercase tracking-wide text-muted-foreground">İçerik eklenmemiş</span>
              </div>
            </div>
          )
        )}
        {data.topics.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu ünitede henüz konu eklenmemiş.</p>}
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitOverviewData(gradeSlug, lessonSlug, unitSlug);
  if (!data) return { title: 'Ünite Bulunamadı' };

  const canonicalPath = `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const topicNames = data.topics.map((t) => t.title).join(', ');
  const title = `${data.unitTitle} — ${data.gradeName} ${data.lessonName}`;
  const description = topicNames
    ? `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesinde ${topicNames} konuları: ders notları ve konu anlatımları.`
    : `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi konu anlatımları.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}
