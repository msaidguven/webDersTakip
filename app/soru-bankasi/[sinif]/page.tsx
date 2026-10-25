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
import { GradeSwitcher } from '@/app/src/components/GradeSwitcher';
import { NeonCount } from '@/app/src/components/robotic/NeonCount';
import { NeonSubjectIcon } from '@/app/src/components/robotic/NeonSubjectIcon';
import r from '../../src/components/robotic/robotic.module.css';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
// 2026-10-02 günlük fallback'a inmişti (Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
// 7 gün (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı): içerik yayını/soru onayı ilgili sayfayı
// zaten anında yeniler (revalidatePath); tüm sayfalar pazartesi 03:00 TR'de (yeni müfredat haftası)
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
  // kartlarıyla aynı görünümde. 2026-10-23: sınıflar sağ sütun yerine başlıkta kutu (/5-sinif ile aynı)
  // — mobilde sütun listenin en altına düşüp görünmüyordu; dersler artık tam genişlik.
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
          aside={
            <GradeSwitcher
              items={gradesIndex.grades
                .filter((g) => g.questionCount > 0 || g.slug === data.gradeSlug)
                .map((g) => ({ level: g.level, href: buildSoruBankasiGradePath(g.slug), current: g.slug === data.gradeSlug }))}
            />
          }
        />

        {!data.hasQuestions && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
            Taslak — bu sınıfta henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
          </p>
        )}

        <section aria-labelledby="dersler" className="mt-10 min-w-0">
          <h2 id="dersler" className={`text-xl font-bold tracking-tight text-default uppercase sm:text-2xl ${r.display}`}>Dersler</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Bir ders seç; üniteleri ve konuları gör.</p>
          {data.lessons.length ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.lessons.map((lesson) => {
                // Robotik kart (2026-10-25, /5-sinif ders kartlarıyla aynı dil): neon köşeli panel, ikon kutusu
                // üzerine gelince dolar; ders rengi yerine tema neonu.
                return (
                  <li key={lesson.slug}>
                    <Link
                      href={buildSoruBankasiLessonPath(data.gradeSlug, lesson.slug)}
                      className={`group flex h-full items-center gap-4 rounded-[22px] p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${r.panel} ${r.itemHover}`}
                    >
                      <NeonSubjectIcon lessonName={lesson.name} className="h-12 w-12" iconClassName="h-6 w-6" />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-bold leading-snug ${r.display} ${r.ink} ${r.groupHoverAccent}`}>{lesson.name}</span>
                        <span className="mt-1.5 block">
                          <NeonCount value={lesson.questionCount} unit="soru" />
                        </span>
                      </span>
                      <ChevronRight className={`h-5 w-5 shrink-0 ${r.muted} ${r.groupHoverAccent}`} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Bu sınıfta henüz ders eklenmemiş.</p>
          )}
        </section>
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
