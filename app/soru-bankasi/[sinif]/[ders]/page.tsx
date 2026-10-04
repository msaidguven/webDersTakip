// app/soru-bankasi/[sinif]/[ders]/page.tsx
// /soru-bankasi hiyerarşisinde ders seviyesi — o sınıf+dersteki üniteleri, altlarında
// konularıyla birlikte listeler (2026-10-03 yenilemesi).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL } from '@/app/src/lib/site';
import { BookOpen } from 'lucide-react';
import {
  getSoruBankasiLessonData,
  getSoruBankasiGradeData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';
import SoruBankasiLessonUnits from '@/app/src/components/SoruBankasiLessonUnits';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
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

  const gradeData = await getSoruBankasiGradeData(sinif);
  const topicCount = data.units.reduce((n, u) => n + u.topics.length, 0);
  const questionCount = data.units.reduce((n, u) => n + u.questionCount, 0);
  const intro = data.units.length
    ? `${data.gradeName} ${data.lessonName} soru bankasında ${data.units.length} ünite, ${topicCount} konu ve ${questionCount} soru var: ` +
      `${joinTr(data.units.map((u) => `${u.title} (${u.questionCount} soru)`))}. Bir ünite ya da konu seçip soruları cevap anahtarı ve açıklamalarıyla inceleyebilirsin.`
    : undefined;

  // 2026-10-03 yenilemesi (konu/ünite sayfalarıyla aynı dil): üniteler konularıyla birlikte
  // listelenir; sağ sütunda sınıfın TÜM dersleri, bu ders vurgulu (bkz. SoruBankasiNavList).
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
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

        <SoruBankasiHeader
          crumbs={[{ name: data.gradeName, href: gradePath }]}
          lessonName={data.lessonName}
          eyebrow={`${data.gradeName} · Ders`}
          title={`${data.lessonName} Soru Bankası`}
          pills={[`${data.units.length} ünite`, `${topicCount} konu`, `${questionCount} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro={intro}
          imageUrl={data.units.find((u) => u.imageUrl)?.imageUrl ?? null}
          imageAlt={`${data.lessonName} dersi görseli`}
        >
          <Link
            href={`/${data.gradeSlug}/${data.lessonSlug}`}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-default bg-background px-4 text-sm font-semibold text-default transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" /> {data.lessonName} konu anlatımları
          </Link>
        </SoruBankasiHeader>

        {!data.hasQuestions && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
            Taslak — bu derste henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <section aria-labelledby="uniteler" className="min-w-0">
            <h2 id="uniteler" className="text-xl font-bold tracking-tight text-default sm:text-2xl">Üniteler ve konular</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Ünitenin tamamından test çözmek için üniteyi, tek bir konu için konuyu seç.</p>
            <SoruBankasiLessonUnits units={data.units} lessonName={data.lessonName} gradeSlug={data.gradeSlug} lessonSlug={data.lessonSlug} />
          </section>

          <aside className="flex flex-col gap-4" aria-label="Soru bankası gezinmesi">
            <SoruBankasiNavList
              id="sinifin-dersleri"
              title={`${data.gradeName} dersleri`}
              items={(gradeData?.lessons ?? []).map((lesson) => ({
                key: lesson.slug,
                href: buildSoruBankasiLessonPath(data.gradeSlug, lesson.slug),
                label: lesson.name,
                meta: `${lesson.questionCount} soru`,
                lessonName: lesson.name,
                current: lesson.slug === data.lessonSlug,
                isPage: true,
              }))}
              footer={
                <Link href={gradePath} className="text-muted-foreground transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
                  Tüm {data.gradeName} soru bankaları →
                </Link>
              }
            />
          </aside>
        </div>
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
