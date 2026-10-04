// app/soru-bankasi/page.tsx
// /soru-bankasi hiyerarşisinin kökü — sınıfları listeler, buradan [sinif]/page.tsx'e (dersler)
// iniliyor. Anasayfadaki "Soru Bankası" kısayolları artık doğrudan bir sınıfa değil buraya
// linkleniyor (kullanıcının 2026-09-06 isteği).
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getSoruBankasiGradesIndexData, buildSoruBankasiIndexPath, buildSoruBankasiGradePath, buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getGradeDescription, formatGradeRange } from '@/app/src/lib/homeMapping';
import { SoruBankasiHeader, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';

// Taslak/admin önizlemesi göstermiyor (public + is_active filtreli), bu yüzden ISR ile
// cache'lenebiliyor — bkz. [sinif]/page.tsx'teki aynı desen.
// 2026-10-02 günlük fallback'a inmişti (Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
// 7 gün (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı): içerik yayını/soru onayı ilgili sayfayı
// zaten anında yeniler (revalidatePath); haftaya bağlı bölümler (Okulda bu hafta) pazartesi sabahı
// toplu yenilenir — bkz. app/src/lib/scheduledCacheRefresh.ts.
export const revalidate = 604800;

export default async function SoruBankasiIndexPage() {
  const data = await getSoruBankasiGradesIndexData();
  const path = buildSoruBankasiIndexPath();

  const gradeRange = formatGradeRange(data.grades.map((g) => g.level));
  const withQuestions = data.grades.filter((g) => g.questionCount > 0);
  const questionCount = withQuestions.reduce((n, g) => n + g.questionCount, 0);

  // 2026-10-03 yenilemesi (soru bankası sayfalarının ortak dili). Sınıf kartında soru yoksa
  // açıklama (getGradeDescription) gösterilir.
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-soru-bankasi-index-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSoruBankasiBreadcrumbJsonLd([{ name: 'Soru Bankası', path }])).replace(/</g, '\\u003c'),
          }}
        />

        <SoruBankasiHeader
          crumbs={[]}
          eyebrow="Ders Takip · MEB müfredatına uygun"
          title="Soru Bankası"
          pills={[`${withQuestions.length} sınıf`, `${questionCount} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro={`${gradeRange || 'Tüm sınıflar'} için ünite ve konulara ayrılmış, cevap anahtarlı ve açıklamalı sorular. Sınıfını seç; dersler, üniteler ve konular üzerinden istediğin soruya ulaş ya da kendini kısa testlerle dene.`}
        />

        <section aria-labelledby="sinifini-sec" className="mt-10">
          <h2 id="sinifini-sec" className="text-xl font-bold tracking-tight text-default sm:text-2xl">Sınıfını seç</h2>
          {data.grades.length ? (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.grades.map((grade) => (
                <li key={grade.slug}>
                  <Link
                    href={buildSoruBankasiGradePath(grade.slug)}
                    className="group flex h-full items-center gap-4 rounded-2xl border border-default bg-background p-4 transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white" aria-hidden="true">
                      {grade.level}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-default group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{grade.name}</span>
                      <span className="text-sm text-muted-foreground">{grade.questionCount > 0 ? `${grade.questionCount} soru` : getGradeDescription(grade.level)}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Henüz sınıf eklenmemiş.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const data = await getSoruBankasiGradesIndexData();
  const path = buildSoruBankasiIndexPath();
  const canonicalUrl = `${SITE_URL}${path}`;
  const gradeNames = data.grades.map((g) => g.name).join(', ');
  const title = 'Soru Bankası - Tüm Sınıflar';
  const description = gradeNames
    ? `${gradeNames} için cevap anahtarlı, ücretsiz soru bankaları.`
    : 'Tüm sınıflar için cevap anahtarlı, ücretsiz soru bankaları.';

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
