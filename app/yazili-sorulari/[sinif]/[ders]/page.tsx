// /yazili-sorulari/6-sinif/matematik — bir dersin yayındaki yazılıları (1./2. dönem, 1./2. yazılı).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliLesson, YAZILI_INDEX_PATH } from '@/app/src/lib/yazili/publicData';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import r from '@/app/src/components/robotic/robotic.module.css';

export const revalidate = 604800;

interface Params {
  sinif: string;
  ders: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

export default async function YaziliLessonPage({ params }: { params: Promise<Params> }) {
  const { sinif, ders } = await params;
  const data = await getYaziliLesson(sinif, ders);
  if (!data) notFound();
  const { lesson } = data;
  const title = `${data.gradeName} ${lesson.name} Yazılı Soruları`;
  const total = lesson.exams.reduce((n, e) => n + e.questionCount, 0);

  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-yazili-lesson-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildSoruBankasiBreadcrumbJsonLd([
                { name: 'Yazılı Soruları', path: YAZILI_INDEX_PATH },
                { name: `${data.gradeName} ${lesson.name}`, path: lesson.path },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />
        <SoruBankasiHeader
          crumbs={[{ name: 'Yazılı Soruları', href: YAZILI_INDEX_PATH }]}
          lessonName={lesson.name}
          eyebrow="2026-2027 · MEB ortak yazılıya uygun"
          title={title}
          pills={[`${lesson.exams.length} yazılı`, `${total} soru`, 'Cevap anahtarlı', 'Ücretsiz']}
          intro={`${data.gradeName} ${lesson.name} dersinin ${joinTr(lesson.exams.map((e) => e.label.toLocaleLowerCase('tr')))} soruları; konu konu, cevap anahtarı ve puanlama ölçütüyle.`}
        />

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <section aria-labelledby="yazililar" className="min-w-0">
            <h2 id="yazililar" className={`text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>Yazılılar</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lesson.exams.map((e) => (
                <li key={e.id}>
                  <Link href={e.path} className={`group flex h-full items-center gap-4 p-4 ${r.item} ${r.itemHover}`}>
                    <span className={`h-12 w-12 shrink-0 text-sm ${r.chipBox}`} aria-hidden="true">{e.term}·{e.examNo}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold text-default ${r.groupHoverAccent}`}>{e.label}</span>
                      <span className="block text-sm text-muted-foreground">
                        {e.questionCount} soru{e.national ? ' · Ülke geneli' : ''}
                      </span>
                      {e.examDate && <ExamCountdown examDate={e.examDate} className={`block text-xs ${r.accent}`} />}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <aside className="flex flex-col gap-4" aria-label="Diğer dersler">
            <SoruBankasiNavList
              id="diger-dersler"
              title={`${data.gradeName} diğer dersler`}
              items={data.otherLessons.map((l) => ({
                key: l.slug,
                href: l.path,
                label: l.name,
                meta: `${l.exams.length} yazılı`,
                lessonName: l.name,
                current: false,
              }))}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif, ders } = await params;
  const data = await getYaziliLesson(sinif, ders);
  if (!data) return { title: 'Yazılı Bulunamadı' };
  const canonicalUrl = `${SITE_URL}${data.lesson.path}`;
  const title = `${data.gradeName} ${data.lesson.name} Yazılı Soruları (2026-2027)`;
  const description = `${data.gradeName} ${data.lesson.name} ${joinTr(data.lesson.exams.map((e) => e.label.toLocaleLowerCase('tr')))} soruları, cevap anahtarı ve puanlama ölçütü. MEB ortak yazılıya uygun, ücretsiz.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'article', images: [{ url: '/og-image.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary', title, description },
  };
}
