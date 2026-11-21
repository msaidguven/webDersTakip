// /yazili-sorulari/6-sinif/1-donem-1-yazili — bir sınıfın o dönem-yazılısındaki bütün dersler (2026-11-02,
// kullanıcı: adres sırası sınıf → yazılı → ders). Öğrenci yazılı haftasında bütün derslerini buradan seçer;
// "6. sınıf 1. dönem 1. yazılı soruları" aramasının karşılığı. Eski ders sayfası (/6-sinif/matematik) kaldırıldı.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliHub, YAZILI_INDEX_PATH } from '@/app/src/lib/yazili/publicData';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import r from '@/app/src/components/robotic/robotic.module.css';

export const revalidate = 604800;

interface Params {
  sinif: string;
  yazili: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export default async function YaziliHubPage({ params }: { params: Promise<Params> }) {
  const { sinif, yazili } = await params;
  const data = await getYaziliHub(sinif, yazili);
  if (!data) notFound();
  const { hub } = data;
  const name = `${data.gradeName} ${hub.label}`;
  const total = hub.lessons.reduce((n, l) => n + l.exam.questionCount, 0);
  const otherHubs = data.hubs.filter((h) => h.slug !== hub.slug);

  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-yazili-hub-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildSoruBankasiBreadcrumbJsonLd([
                { name: 'Yazılı Soruları', path: YAZILI_INDEX_PATH },
                { name, path: hub.path },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />
        <SoruBankasiHeader
          crumbs={[{ name: 'Yazılı Soruları', href: YAZILI_INDEX_PATH }]}
          eyebrow="2026-2027 · MEB ortak yazılıya uygun"
          title={`${name} Soruları`}
          pills={[`${hub.lessons.length} ders`, `${total} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
        />

        <div className={`mt-10 grid grid-cols-1 items-start gap-6 lg:gap-x-8 ${otherHubs.length ? 'lg:grid-cols-[minmax(0,1fr)_350px]' : ''}`}>
          <div className="flex min-w-0 flex-col gap-8">
            <section aria-labelledby="dersler">
              <h2 id="dersler" className="text-base font-bold text-default">Hangi dersin yazılısına çalışacaksın?</h2>
              <ul className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 ${otherHubs.length ? '' : 'lg:grid-cols-3'}`}>
                {hub.lessons.map((l) => (
                  <li key={l.exam.id}>
                    <Link href={l.exam.path} className={`group flex h-full items-center gap-3 p-4 ${r.item} ${r.itemHover}`}>
                      <SubjectIcon lessonName={l.name} size="sm" variant="solid" />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold text-default ${r.groupHoverAccent}`}>{l.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {l.exam.questionCount} soru{l.exam.national ? ' · Ülke geneli sınav' : ''}
                        </span>
                        {l.exam.examDate && <ExamCountdown examDate={l.exam.examDate} className={`block text-xs ${r.accent}`} />}
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="yazili-hakkinda" className={`p-5 sm:p-6 ${r.panel}`}>
              <h2 id="yazili-hakkinda" className="text-base font-bold text-default">Bu yazılı hakkında</h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                {name.toLocaleLowerCase('tr')} için {joinTr(hub.lessons.map((l) => l.name))} derslerinden {total} açık uçlu soru.
                Her sorunun cevabı var; sorular 2026-2027 MEB ortak yazılı konu-soru dağılım tablolarındaki konulara göre hazırlandı.
                Ders seç, soruları konu ve zorluğa göre süz ya da yapay zekâ puanlı yazılı provası çöz.
              </p>
            </section>
          </div>

          {otherHubs.length > 0 && (
            <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Diğer yazılılar">
              <SoruBankasiNavList
                id="diger-yazililar"
                title={`${data.gradeName} diğer yazılıları`}
                items={otherHubs.map((h) => ({
                  key: h.slug,
                  href: h.path,
                  label: h.label,
                  meta: `${h.lessons.length} ders`,
                  badge: `${h.term}·${h.examNo}`,
                  lessonName: '',
                  current: false,
                  isPage: true,
                }))}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif, yazili } = await params;
  const data = await getYaziliHub(sinif, yazili);
  if (!data) return { title: 'Yazılı Bulunamadı' };
  const name = `${data.gradeName} ${data.hub.label}`;
  const canonicalUrl = `${SITE_URL}${data.hub.path}`;
  const title = `${name} Soruları (2026-2027) — Tüm Dersler, Cevap Anahtarlı`;
  const description = `${name} soruları: ${joinTr(data.hub.lessons.map((l) => l.name))}. MEB ortak yazılıya uygun açık uçlu sorular ve cevap anahtarı, ücretsiz.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'article', images: [{ url: '/og-image.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary', title, description },
  };
}
