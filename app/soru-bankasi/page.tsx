// app/soru-bankasi/page.tsx
// /soru-bankasi hiyerarşisinin kökü — sınıfları listeler, buradan [sinif]/page.tsx'e (dersler)
// iniliyor. Anasayfadaki "Soru Bankası" kısayolları artık doğrudan bir sınıfa değil buraya
// linkleniyor (kullanıcının 2026-09-06 isteği).
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getSoruBankasiGradesIndexData, buildSoruBankasiIndexPath, buildSoruBankasiGradePath, buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getGradeIcon, getGradeColor, getGradeDescription } from '@/app/src/lib/homeMapping';

// Taslak/admin önizlemesi göstermiyor (public + is_active filtreli), bu yüzden ISR ile
// cache'lenebiliyor — bkz. [sinif]/page.tsx'teki aynı desen.
export const revalidate = 3600;

export default async function SoruBankasiIndexPage() {
  const data = await getSoruBankasiGradesIndexData();
  const path = buildSoruBankasiIndexPath();

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <script
        id="structured-data-soru-bankasi-index-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSoruBankasiBreadcrumbJsonLd([{ name: 'Soru Bankası', path }])).replace(/</g, '\\u003c'),
        }}
      />

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Soru Bankası</p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">Sınıfını Seç</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">5. sınıftan 12. sınıfa, cevap anahtarlı soru bankasına ulaş.</p>
      </div>

      <div className="space-y-2.5">
        {data.grades.map((grade) => (
          <Link
            key={grade.slug}
            href={buildSoruBankasiGradePath(grade.slug)}
            className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getGradeColor(grade.level)} text-lg shadow-sm`}>
              {getGradeIcon(grade.level)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-default">{grade.name}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {grade.questionCount > 0 ? `${grade.questionCount} soru` : getGradeDescription(grade.level)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {data.grades.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Henüz sınıf eklenmemiş.</p>}
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
