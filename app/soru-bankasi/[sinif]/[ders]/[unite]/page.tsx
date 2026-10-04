// app/soru-bankasi/[sinif]/[ders]/[unite]/page.tsx
// /soru-bankasi hiyerarşisinde ünite seviyesi. Konular BURADA accordion olarak açılıp
// sorularını göstermiyor — her konu kendi sayfasına (bkz. [konu]/page.tsx) link veriyor
// (kullanıcının 2026-09-05 isteği: "konular akordiyon olarak soruları değil, konu
// sayfasına yönlendirsin"). 2026-10-03: konu sayfasıyla aynı tasarım diline geçti (banner →
// başlığın yanında görsel, "Konu Bazlı Analizler" → sade konu listesi, bkz.
// SoruBankasiUnitTopicAnalytics.tsx).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SITE_URL } from '@/app/src/lib/site';
import {
  getSoruBankasiUnitData,
  getSoruBankasiLessonData,
  getSoruBankasiGradeData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiUnitPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';
import { BookOpen } from 'lucide-react';
import TestStatusCard from '@/app/src/components/TestStatusCard';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import type { SoruBankasiUnitData } from '@/app/src/lib/soruBankasiPageData';
import SoruBankasiUnitTopicAnalytics from '@/app/src/components/SoruBankasiUnitTopicAnalytics';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
// 2026-10-02 günlük fallback'a inmişti (Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
// 7 gün (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı): içerik yayını/soru onayı ilgili sayfayı
// zaten anında yeniler (revalidatePath); tüm sayfalar pazar 10:00 TR'de (yeni müfredat haftası)
// toplu yenilenir — bkz. app/src/lib/scheduledCacheRefresh.ts.
export const revalidate = 604800;

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
  // Konu sayfasındaki ("Bu Sınıftaki Diğer Dersler") ile aynı iç linkleme deseni (2026-09-10
  // kullanıcı talebi) — bu sayfada hiç alt/kardeş linkleri yoktu.
  const lessonData = await getSoruBankasiLessonData(sinif, ders);
  // Sağ sütunda dersin TÜM üniteleri + sınıfın TÜM dersleri (2026-10-03, kullanıcı isteği):
  // içindekiler gibi, bulunulan yer vurgulu (bkz. SoruBankasiNavList).
  const lessonUnits = lessonData?.units ?? [];
  const gradeData = await getSoruBankasiGradeData(sinif);

  const totalQuestions = data.topics.reduce((n, t) => n + t.questionCount, 0);

  // 2026-10-03 yenilemesi (konu sayfasıyla aynı tasarım dili): başlık + veriden türetilen özgün
  // giriş metni (masaüstünde sağda ünite görseli), konu listesi; ünite testi ve dersin diğer
  // üniteleri sağ sütunda (mobilde test kartı listenin üstünde, diğer üniteler en altta).
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
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

        <SoruBankasiHeader
          crumbs={[
            { name: data.gradeName, href: gradePath },
            { name: data.lessonName, href: lessonPath },
          ]}
          lessonName={data.lessonName}
          eyebrow={`${data.gradeName} · ${data.lessonName} · Ünite`}
          title={`${data.unitTitle} Soru Bankası`}
          pills={[`${data.topics.length} konu`, `${totalQuestions} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro={data.topics.length > 0 ? buildUnitIntro(data, totalQuestions) : undefined}
          imageUrl={data.bannerImageUrl}
          imageAlt={`${data.unitTitle} ünitesi görseli`}
        >
          <Link
            href={`/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}`}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-default bg-background px-4 text-sm font-semibold text-default transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" /> Ünitenin konu anlatımları
          </Link>
        </SoruBankasiHeader>

        {!data.hasQuestions && (
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
            Taslak — bu ünitede henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
          </p>
        )}

        {/* lg:grid-rows-[auto_1fr]: uzun konu listesi iki satıra yayılırken boşluk ilk satıra
            (test kartı) değil ikinciye gitsin — yoksa sağ alttaki kart sayfanın dibine düşüyor. */}
        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr] lg:gap-x-8">
          {/* Puanlı ünite testi aynı sayfada, URL değişmeden modal olarak açılır (bkz. TestStatusCard). */}
          {data.hasQuestions && (
            <div className="lg:col-start-2 lg:row-start-1">
              <TestStatusCard
                scope="unit"
                gradeSlug={data.gradeSlug}
                lessonSlug={data.lessonSlug}
                unitSlug={data.unitSlug}
                unitId={data.unitId}
                title="Ünite testi"
                color="indigo"
              />
            </div>
          )}

          <section aria-labelledby="konular" className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <h2 id="konular" className="text-xl font-bold tracking-tight text-default sm:text-2xl">{data.unitTitle} ünitesinin konuları</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Bir konu seç; soruları cevap anahtarı ve açıklamalarıyla gör.</p>
            {data.topics.length > 0 ? (
              <SoruBankasiUnitTopicAnalytics
                unitId={data.unitId}
                topics={data.topics}
                lessonName={data.lessonName}
                gradeSlug={data.gradeSlug}
                lessonSlug={data.lessonSlug}
                unitSlug={data.unitSlug}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Bu ünitede henüz konu eklenmemiş.</p>
            )}
          </section>

          {/* İç linkleme (2026-09-10 kullanıcı talebi): dersin diğer üniteleri + ders/sınıf hub'ları. */}
          <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-start-2" aria-label="Soru bankası gezinmesi">
            <SoruBankasiNavList
              id="dersin-uniteleri"
              title={`${data.lessonName} üniteleri`}
              items={lessonUnits.map((unit) => ({
                key: unit.slug,
                href: buildSoruBankasiUnitPath(data.gradeSlug, data.lessonSlug, unit.slug),
                label: unit.title,
                eyebrow: `${unit.number}. ünite`,
                meta: `${unit.topics.length} konu · ${unit.questionCount} soru`,
                imageUrl: unit.imageUrl,
                lessonName: data.lessonName,
                current: unit.slug === data.unitSlug,
                isPage: true,
              }))}
            />
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

// Her ünite sayfasına özgün giriş metni (SEO; veriden türetilir): konular ve soru sayıları.
function buildUnitIntro(data: SoruBankasiUnitData, totalQuestions: number): string {
  const parts = data.topics.map((t) => `${t.title} (${t.questionCount} soru)`);
  const list = joinTr(parts);
  return (
    `${data.gradeName} ${data.lessonName} dersinin ${data.unitTitle} ünitesinde ${data.topics.length} konu ve ${totalQuestions} soru var: ${list}. ` +
    'Bir konuyu seçip sorularını cevap anahtarıyla inceleyebilir ya da tüm üniteden karışık bir test çözebilirsin.'
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
