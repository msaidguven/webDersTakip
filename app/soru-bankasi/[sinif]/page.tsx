// app/soru-bankasi/[sinif]/page.tsx
// /soru-bankasi hiyerarşisinin en üst (sınıf) seviyesi — o sınıftaki dersleri, her birinin
// soru sayısıyla birlikte listeler. Aşağı seviyeler: [ders]/page.tsx (üniteler),
// [ders]/[unite]/page.tsx (konular), [ders]/[unite]/[konu]/page.tsx (asıl soru bankası).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import {
  getSoruBankasiGradeData,
  getSoruBankasiGradesIndexData,
  buildSoruBankasiIndexPath,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { subjectStyle } from '@/app/src/lib/subjectStyle';

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
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export default async function SoruBankasiGradePage({ params }: { params: Promise<Params> }) {
  const { sinif } = await params;
  const data = await getSoruBankasiGradeData(sinif);
  if (!data) notFound();

  const path = buildSoruBankasiGradePath(data.gradeSlug);

  const gradesIndex = await getSoruBankasiGradesIndexData();
  const questionCount = data.lessons.reduce((n, l) => n + l.questionCount, 0);
  const intro = data.lessons.length
    ? `${data.gradeName} soru bankasında ${data.lessons.length} ders ve ${questionCount} soru var: ` +
      `${joinTr(data.lessons.map((l) => `${l.name} (${l.questionCount} soru)`))}. Bir ders seç; ünite ve konulara ayrılmış, cevap anahtarlı ve açıklamalı sorulara ulaş.`
    : undefined;

  // 2026-10-03 yenilemesi (konu/ünite/ders sayfalarıyla aynı dil): dersler anasayfadaki ders
  // kartlarıyla aynı görünümde; sağ sütunda TÜM sınıflar, bu sınıf vurgulu.
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-soru-bankasi-grade-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSoruBankasiBreadcrumbJsonLd([{ name: `${data.gradeName} Soru Bankası`, path }])).replace(/</g, '\\u003c'),
          }}
        />

        <SoruBankasiHeader
          crumbs={[{ name: 'Soru Bankası', href: buildSoruBankasiIndexPath() }]}
          eyebrow="MEB müfredatına uygun · Sınıf"
          title={`${data.gradeName} Soru Bankası`}
          pills={[`${data.lessons.length} ders`, `${questionCount} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro={intro}
        />

        {!data.hasQuestions && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
            Taslak — bu sınıfta henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <section aria-labelledby="dersler" className="min-w-0">
            <h2 id="dersler" className="text-xl font-bold tracking-tight text-default sm:text-2xl">Dersler</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Bir ders seç; üniteleri ve konuları gör.</p>
            {data.lessons.length ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.lessons.map((lesson) => (
                  <li key={lesson.slug}>
                    <Link
                      href={buildSoruBankasiLessonPath(data.gradeSlug, lesson.slug)}
                      className={`group flex h-full items-center gap-4 rounded-2xl border p-4 transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)] ${subjectStyle(lesson.name).tint}`}
                    >
                      <SubjectIcon lessonName={lesson.name} variant="solid" size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug text-default group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{lesson.name}</span>
                        <span className="text-sm text-muted-foreground">{lesson.questionCount} soru</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Bu sınıfta henüz ders eklenmemiş.</p>
            )}
          </section>

          <aside className="flex flex-col gap-4" aria-label="Soru bankası gezinmesi">
            <SoruBankasiNavList
              id="siniflar"
              title="Sınıflar"
              items={gradesIndex.grades
                .filter((g) => g.questionCount > 0 || g.slug === data.gradeSlug)
                .map((g) => ({
                  key: g.slug,
                  href: buildSoruBankasiGradePath(g.slug),
                  label: g.name,
                  meta: `${g.questionCount} soru`,
                  badge: String(g.level),
                  lessonName: '',
                  current: g.slug === data.gradeSlug,
                  isPage: true,
                }))}
            />
          </aside>
        </div>
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
