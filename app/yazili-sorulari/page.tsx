// /yazili-sorulari — yayındaki tüm yazılılar, sınıf → dönem-yazılı → ders (2026-11-02). Üstte tarihi belli yaklaşan yazılılar.
import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/app/src/lib/site';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliIndex, gradeHubs, YAZILI_INDEX_PATH } from '@/app/src/lib/yazili/publicData';
import { SoruBankasiAbout, SoruBankasiHeader, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import { OfficialSourceNotice } from '@/app/src/components/OfficialSourceNotice';
import r from '@/app/src/components/robotic/robotic.module.css';

export const revalidate = 3600;

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
        />

        {grades.length > 1 && (
          <nav aria-label="Sınıfa hızlı geçiş" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide lg:hidden">
            {grades.map((g) => (
              <a
                key={g.slug}
                href={`#${g.slug}`}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-xs font-bold active:scale-[0.98] ${r.item}`}
              >
                {g.name}
              </a>
            ))}
          </nav>
        )}

        {dated.length > 0 && (
          <section aria-labelledby="yaklasan" className={`mt-5 p-4 sm:mt-8 sm:p-6 ${r.panel}`}>
            <h2 id="yaklasan" className={r.label}>Tarihi belli yazılılar</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {dated.map((e) => (
                <li key={e.id}>
                  <Link href={e.path} className={`flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 p-3 active:scale-[0.99] ${r.item} ${r.itemHover}`}>
                    <span className="font-semibold text-default">{e.gradeName} {e.lessonName} · {e.label}</span>
                    <ExamCountdown examDate={e.examDate!} className={`text-sm ${r.accent}`} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-2">
          {grades.map((g) => {
            const hubs = gradeHubs(g);
            return (
              <section key={g.slug} id={g.slug} aria-labelledby={`sinif-${g.slug}`} className="min-w-0 scroll-mt-20">
                <h2 id={`sinif-${g.slug}`} className={`text-lg font-extrabold uppercase text-default sm:text-2xl ${r.display}`}>{g.name}</h2>
                <ul className={`mt-3 grid grid-cols-1 gap-3 sm:mt-4 ${hubs.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                  {hubs.map((h) => (
                    <li key={h.slug} className={`flex flex-col gap-3 p-4 ${r.item}`}>
                      <Link href={h.path} className={`flex min-h-10 items-center gap-3 font-semibold text-default ${r.hoverAccent}`}>
                        <span className={`h-9 w-9 shrink-0 text-xs ${r.chipBox}`} aria-hidden="true">{h.term}·{h.examNo}</span>
                        {h.label}
                        <span className="text-xs font-normal text-muted-foreground">{h.lessons.length} ders</span>
                      </Link>
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {h.lessons.map((l) => (
                          <li key={l.exam.id}>
                            <Link href={l.exam.path} className={`flex min-h-10 items-center gap-2.5 rounded-xl px-1.5 py-1 text-muted-foreground active:scale-[0.99] ${r.hoverAccent}`}>
                              <SubjectIcon lessonName={l.name} size="sm" variant="solid" />
                              <span className="font-medium text-default">{l.name}</span>
                              <span className="text-xs text-muted-foreground">({l.exam.questionCount} soru)</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {!grades.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Yazılı soruları hazırlanıyor.</p>}
        </div>

        {/* Açıklama listelerin altında (soru bankası sayfalarıyla aynı düzen): telefonda sınıf listesine ulaşmak için kaydırmak gerekmesin. */}
        <SoruBankasiAbout text="Sınıfa ve yazılıya göre 1. ve 2. dönem yazılı soruları. Sorular MEB'in konu-soru dağılım tablolarındaki konulara göre hazırlandı; her sorunun cevabı var." />
        <OfficialSourceNotice
          sources={['odsgm', 'tymm']}
          description="Bu sayfadaki yazılı soruları, MEB tarafından yayımlanan ortak yazılı konu-soru dağılım tabloları referans alınarak hazırlanmıştır."
          className="mt-4"
        />
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const grades = await getYaziliIndex();
  const canonicalUrl = `${SITE_URL}${YAZILI_INDEX_PATH}`;
  const title = 'Yazılı Soruları 2026-2027 — 1. ve 2. Dönem, Cevap Anahtarlı';
  const description = 'Ortaokul yazılı soruları: sınıf ve derse göre 1. dönem 1. ve 2. yazılı, tüm dersler, MEB ortak yazılı konu-soru dağılımına uygun, cevap anahtarıyla.';
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
