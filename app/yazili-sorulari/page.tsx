// /yazili-sorulari — yayındaki tüm yazılılar, sınıf → ders. Üstte tarihi belli yaklaşan yazılılar.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/app/src/lib/site';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliIndex, YAZILI_INDEX_PATH } from '@/app/src/lib/yazili/publicData';
import { SoruBankasiHeader, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import r from '@/app/src/components/robotic/robotic.module.css';

export const revalidate = 604800;

export default async function YaziliIndexPage() {
  const grades = await getYaziliIndex();
  const allExams = grades.flatMap((g) => g.lessons.flatMap((l) => l.exams.map((e) => ({ ...e, gradeName: g.name, lessonName: l.name }))));
  // Tarihi geçmiş olanlar da sunucuda listede; "yaklaşan" sırası tarihe göre. Geri sayım tarayıcıda.
  const dated = allExams.filter((e) => e.examDate).sort((a, b) => a.examDate!.localeCompare(b.examDate!));

  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-yazili-index-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSoruBankasiBreadcrumbJsonLd([{ name: 'Yazılı Soruları', path: YAZILI_INDEX_PATH }])).replace(/</g, '\\u003c'),
          }}
        />
        <SoruBankasiHeader
          crumbs={[]}
          eyebrow="2026-2027 · MEB ortak yazılıya uygun"
          title="Yazılı Soruları"
          pills={[`${allExams.length} yazılı`, `${allExams.reduce((n, e) => n + e.questionCount, 0)} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro="Sınıf ve derse göre 1. ve 2. dönem yazılı soruları. Sorular MEB'in konu-soru dağılım tablolarındaki konulara göre hazırlandı; her sorunun cevabı ve puanlama ölçütü var."
        />

        {dated.length > 0 && (
          <section aria-labelledby="yaklasan" className={`mt-8 p-5 sm:p-6 ${r.panel}`}>
            <h2 id="yaklasan" className={r.label}>Tarihi belli yazılılar</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {dated.map((e) => (
                <li key={e.id}>
                  <Link href={e.path} className={`flex flex-wrap items-center gap-x-3 gap-y-1 p-3 ${r.item} ${r.itemHover}`}>
                    <span className="font-semibold text-default">{e.gradeName} {e.lessonName} · {e.label}</span>
                    <ExamCountdown examDate={e.examDate!} className={`text-sm ${r.accent}`} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10 flex flex-col gap-10">
          {grades.map((g) => (
            <section key={g.slug} id={g.slug} aria-labelledby={`sinif-${g.slug}`}>
              <h2 id={`sinif-${g.slug}`} className={`text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>{g.name}</h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {g.lessons.map((l) => (
                  <li key={l.slug} className={`flex flex-col gap-2 p-4 ${r.item}`}>
                    <Link href={l.path} className={`flex items-center gap-3 font-semibold text-default ${r.hoverAccent}`}>
                      <SubjectIcon lessonName={l.name} size="sm" variant="solid" />
                      {l.name}
                    </Link>
                    <ul className="flex flex-col gap-1 text-sm">
                      {l.exams.map((e) => (
                        <li key={e.id}>
                          <Link href={e.path} className={`text-muted-foreground ${r.hoverAccent}`}>
                            {e.label} <span className="text-xs">({e.questionCount} soru)</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!grades.length && <p className="py-8 text-center text-sm text-muted-foreground">Yazılı soruları hazırlanıyor.</p>}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const grades = await getYaziliIndex();
  const canonicalUrl = `${SITE_URL}${YAZILI_INDEX_PATH}`;
  const title = 'Yazılı Soruları 2026-2027 — 1. ve 2. Dönem, Cevap Anahtarlı';
  const description = 'Ortaokul yazılı soruları: sınıf ve derse göre 1. dönem 1. ve 2. yazılı, MEB ortak yazılı konu-soru dağılımına uygun, cevap anahtarı ve puanlama ölçütüyle.';
  const hasContent = grades.length > 0;
  return {
    title,
    description,
    robots: { index: hasContent, follow: true },
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'website', images: [{ url: '/og-image.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary', title, description },
  };
}
