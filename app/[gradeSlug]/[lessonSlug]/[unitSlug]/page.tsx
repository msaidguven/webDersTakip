// app/[gradeSlug]/[lessonSlug]/[unitSlug]/page.tsx
// Ünite tanıtım sayfası (kullanıcının 2026-09-06 isteği) — ünite kapak görseli + konuların
// başlık/kapak görseli/kısa açıklamasını listeler, her konu kartı gerçek konu sayfasına
// (DersClient) link verir. Bilinçli olarak DersClient'ın sidebar'ını/aktif konu state'ini
// KULLANMIYOR (bkz. unitOverviewPageData.ts) — sadece nötr bir tanıtım/liste sayfası.
// 2026-10-03: soru bankası sayfalarıyla aynı tasarım diline geçti.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ChevronRight, ListChecks } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getUnitOverviewData } from '@/app/src/lib/unitOverviewPageData';
import { getSoruBankasiLessonData, getSoruBankasiUnitData, buildSoruBankasiUnitPath } from '@/app/src/lib/soruBankasiPageData';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { subjectStyle } from '@/app/src/lib/subjectStyle';

// Günlük fallback (2026-10-02, Vercel aktif CPU sınırı aşılıyordu — saatlik yenileme botlar
// dolaştıkça aynı sayfayı günde 24 kez baştan üretiyordu). İçerik/soru değişince sayfa zaten
// anında yenileniyor (bkz. app/src/lib/topicPageRevalidation.ts); bu süre yalnızca tarihe bağlı
// bilgiler (ör. müfredat haftası) için üst sınır. Segment config literal olmak zorunda.
export const revalidate = 86400;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getUnitOverviewData>>>) {
  const lessonPath = `/${data.gradeSlug}/${data.lessonSlug}`;
  const unitPath = `${lessonPath}/${data.unitSlug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}${lessonPath}` },
      { '@type': 'ListItem', position: 4, name: data.unitTitle, item: `${SITE_URL}${unitPath}` },
    ],
  };
}

export default async function UnitOverviewPage({ params }: { params: Promise<Params> }) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitOverviewData(gradeSlug, lessonSlug, unitSlug);
  if (!data) notFound();

  const lessonPath = `/${data.gradeSlug}/${data.lessonSlug}`;
  const unitPath = `${lessonPath}/${data.unitSlug}`;
  // Soru sayıları ve ünite görselleri soru bankası verisinden (aynı ISR önbelleği, ek tanım yok).
  const [sbUnit, sbLesson] = await Promise.all([
    getSoruBankasiUnitData(data.gradeSlug, data.lessonSlug, data.unitSlug),
    getSoruBankasiLessonData(data.gradeSlug, data.lessonSlug),
  ]);
  const questionsByTopic = new Map((sbUnit?.topics ?? []).map((t) => [t.id, t.questionCount]));
  const sbUnitBySlug = new Map((sbLesson?.units ?? []).map((u) => [u.slug, u]));
  const unitQuestionCount = (sbUnit?.topics ?? []).reduce((n, t) => n + t.questionCount, 0);
  const unitNumber = data.siblingUnits.findIndex((u) => u.slug === data.unitSlug) + 1;
  const firstTopic = data.topics.find((t) => t.hasContent);

  const description = data.unitDescription && !data.unitDescription.startsWith(data.unitTitle) ? ` ${data.unitDescription}` : '';
  const intro = data.topics.length
    ? `${data.gradeName} ${data.lessonName} dersinin ${data.unitTitle} ünitesi ${data.topics.length} konudan oluşur: ${joinTr(data.topics.map((t) => t.title))}.${description} ` +
      'Her konunun anlatımını oku, ardından kısa testler ve soru bankasıyla kendini dene.'
    : undefined;

  // 2026-10-03 yenilemesi (soru bankası sayfalarıyla aynı dil, kullanıcı onaylı): üstteki renkli
  // Sınıf/Ders/Ünite/Konu seçici (UnitHierarchyBar) kalktı — aynı işi sağ sütundaki dersin
  // üniteleri + sınıfın dersleri listeleri görüyor (bulunulan yer vurgulu, bkz. SoruBankasiNavList).
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <script
          id="structured-data-unit-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
          }}
        />

        <SoruBankasiHeader
          crumbs={[
            { name: data.gradeName, href: `/${data.gradeSlug}` },
            { name: data.lessonName, href: lessonPath },
          ]}
          lessonName={data.lessonName}
          eyebrow={`${data.gradeName} · ${data.lessonName}${unitNumber ? ` · ${unitNumber}. ünite` : ''}`}
          title={data.unitTitle}
          pills={[`${data.topics.length} konu`, ...(unitQuestionCount ? [`${unitQuestionCount} soru`] : []), 'Konu anlatımı', 'Ücretsiz']}
          intro={intro}
          imageUrl={data.coverImageUrl}
          imageAlt={`${data.unitTitle} ünitesi görseli`}
        >
          <div className="mt-5 flex flex-wrap gap-2">
            {firstTopic && (
              <Link
                href={`${unitPath}/${firstTopic.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Konu anlatımına başla <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            {unitQuestionCount > 0 && (
              <Link
                href={buildSoruBankasiUnitPath(data.gradeSlug, data.lessonSlug, data.unitSlug)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-default bg-background px-4 text-sm font-semibold text-default transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                <ListChecks className="h-4 w-4" aria-hidden="true" /> Ünite soru bankası
              </Link>
            )}
          </div>
        </SoruBankasiHeader>

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <section aria-labelledby="konular" className="min-w-0">
            <h2 id="konular" className="text-xl font-bold tracking-tight text-default sm:text-2xl">{data.unitTitle} ünitesinin konuları</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Bir konu seç; anlatımı oku, slaytlarla tekrar et, testle kendini dene.</p>
            {data.topics.length ? (
              <ol className="flex flex-col gap-3">
                {data.topics.map((topic, i) => {
                  const questions = questionsByTopic.get(topic.id) ?? 0;
                  const visual = topic.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topic.heroImageUrl} alt="" loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-xl bg-surface-elevated object-cover sm:h-20 sm:w-32" />
                  ) : (
                    <span className={`flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border sm:h-20 sm:w-32 ${subjectStyle(data.lessonName).tint}`} aria-hidden="true">
                      <SubjectIcon lessonName={data.lessonName} variant="solid" />
                    </span>
                  );
                  const body = (
                    <span className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{i + 1}. konu</span>
                      <span className="mt-0.5 block font-semibold leading-snug text-default transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{topic.title}</span>
                      {topic.subtitle && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{topic.subtitle}</span>}
                      <span className="mt-1.5 block text-xs font-medium text-muted-foreground">
                        {topic.hasContent ? (questions ? `Konu anlatımı · ${questions} soru` : 'Konu anlatımı') : 'Yakında'}
                      </span>
                    </span>
                  );
                  return (
                    <li key={topic.id}>
                      {topic.hasContent ? (
                        <Link
                          href={`${unitPath}/${topic.slug}`}
                          className="group flex items-center gap-4 rounded-[20px] border border-default bg-background p-3 transition-all hover:border-indigo-300 hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)] sm:p-4"
                        >
                          {visual}
                          {body}
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Link>
                      ) : (
                        <div className="flex items-center gap-4 rounded-[20px] border border-dashed border-default p-3 opacity-70 sm:p-4">
                          {visual}
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Bu ünitede henüz konu eklenmemiş.</p>
            )}
          </section>

          <aside className="flex flex-col gap-4" aria-label="Ders gezinmesi">
            <SoruBankasiNavList
              id="dersin-uniteleri"
              title={`${data.lessonName} üniteleri`}
              items={data.siblingUnits.map((u, i) => {
                const sb = sbUnitBySlug.get(u.slug);
                return {
                  key: u.slug,
                  href: `${lessonPath}/${u.slug}`,
                  label: u.title,
                  eyebrow: `${i + 1}. ünite`,
                  meta: sb ? `${u.topicCount} konu · ${sb.questionCount} soru` : `${u.topicCount} konu`,
                  imageUrl: sb?.imageUrl ?? null,
                  lessonName: data.lessonName,
                  current: u.slug === data.unitSlug,
                  isPage: true,
                };
              })}
            />
            <SoruBankasiNavList
              id="sinifin-dersleri"
              title={`${data.gradeName} dersleri`}
              items={data.gradeLessons.map((l) => ({
                key: l.slug,
                href: `/${data.gradeSlug}/${l.slug}`,
                label: l.name,
                meta: 'Konu anlatımları',
                lessonName: l.name,
                current: l.slug === data.lessonSlug,
              }))}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitOverviewData(gradeSlug, lessonSlug, unitSlug);
  if (!data) return { title: 'Ünite Bulunamadı' };

  const canonicalPath = `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const topicNames = data.topics.map((t) => t.title).join(', ');
  const title = `${data.unitTitle} Konu Anlatımı — ${data.gradeName} ${data.lessonName}`;
  const description = topicNames
    ? `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi konu anlatımı: ${topicNames}. Ders notları, sesli anlatım ve testler.`
    : `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi konu anlatımları.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: 'article' },
    twitter: { card: 'summary', title, description },
  };
}
