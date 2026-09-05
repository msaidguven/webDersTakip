// app/soru-bankasi/[sinif]/[ders]/[unite]/page.tsx
// /soru-bankasi hiyerarşisinde ünite seviyesi — o üniteye ait konuları, her birinin soru
// sayısıyla birlikte listeler. Bir konuya tıklayınca asıl soru bankası sayfasına gider
// (bkz. [konu]/page.tsx).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Trophy, ArrowRight } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import {
  getSoruBankasiUnitData,
  buildSoruBankasiGradePath,
  buildSoruBankasiLessonPath,
  buildSoruBankasiUnitPath,
  buildSoruBankasiBreadcrumbJsonLd,
} from '@/app/src/lib/soruBankasiPageData';

// Taslak/admin önizlemesi göstermiyor (public + is_active/soru>0 filtreli), bu yüzden
// ISR ile cache'lenebiliyor — bkz. [gradeSlug]/page.tsx'teki aynı desen.
export const revalidate = 3600;

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

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
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

      <Link href={lessonPath} className="mb-2 inline-block text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500 sm:mb-4">
        ← {data.lessonName} Soru Bankası
      </Link>

      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
          {data.gradeName} • {data.lessonName}
        </p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">{data.unitTitle} Soru Bankası</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">Bir konu seç, cevap anahtarlı soru bankasına ulaş.</p>
      </div>

      {!data.hasQuestions && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu ünitede henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}

      {/* Soru bankası inceleme amaçlı (cevap anahtarıyla, puansız); asıl puanlı testi de
          aynı sayfadan başlatabilsin diye ünite testine buton — konu sayfasındaki
          QuizCtaCards'la (DersClientCards.tsx) BİREBİR aynı isim/renk/ikon/CTA metni
          kullanılıyor, aynı hedefe iki farklı yerden farklı görünümle gitmesin diye
          (bkz. [[feedback_information_architecture_discipline]]). */}
      {data.hasQuestions && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:mb-6 sm:p-5">
          <div className="flex items-center gap-2.5 text-sm font-black text-emerald-700">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
              <Trophy className="h-4.5 w-4.5" />
            </span>
            Ünite Testi
          </div>
          <p className="flex-1 text-xs font-medium leading-relaxed text-emerald-900/70">
            Aşağıdakiler cevap anahtarıyla inceleme amaçlı — {data.unitTitle} ünitesini puanlı test etmek için ünite testini çöz.
          </p>
          <Link
            href={`/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/unite-testi`}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-emerald-700"
          >
            Teste Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="space-y-2.5">
        {data.topics.map((topic) => (
          <Link
            key={topic.slug}
            href={`${path}/${topic.slug}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-default">{topic.title}</p>
              {topic.questionCount === 0 ? (
                <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-500">Taslak</span>
              ) : (
                <span className="mt-1 inline-block text-xs font-bold text-muted-foreground">{topic.questionCount} soru</span>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {data.topics.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu ünitede henüz konu eklenmemiş.</p>}
      </div>
    </div>
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
