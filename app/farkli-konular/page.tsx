// app/farkli-konular/page.tsx
// Müfredattan çıkarılmış ama sayfası canlı/indekslenebilir kalan konuların (bkz.
// topics.is_archived) toplandığı arşiv sayfası — normal navigasyondan (ünite sayfası,
// anasayfa, soru bankası) bilinçli olarak gizlenen bu konulara buradan ve footer'daki
// "Farklı Konular" linkinden ulaşılır. Public + is_active filtreli olduğu için ISR ile
// cache'lenebiliyor (bkz. [topicSlug]/page.tsx'teki aynı desen).
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { SITE_URL } from '@/app/src/lib/site';
import { getFarkliKonularData } from '@/app/src/lib/farkliKonularPageData';

export const revalidate = 3600;

const canonicalPath = '/farkli-konular';

export default async function FarkliKonularPage() {
  const gradeGroups = await getFarkliKonularData();

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-12">
      <div className="mb-4 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:mb-6 sm:p-6">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Farklı Konular</p>
        <h1 className="mt-1 text-lg font-black leading-tight text-default sm:text-2xl">Müfredat Dışı Konular</h1>
        <p className="mt-1 text-xs font-bold text-muted-foreground sm:text-sm">
          Aşağıdaki konular artık güncel müfredatta yer almıyor. Genel kültür amaçlı olarak yayında tutuluyor ve
          dilediğin zaman okuyabilirsin.
        </p>
      </div>

      {gradeGroups.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-muted-foreground">Şu anda arşivlenmiş bir konu bulunmuyor.</p>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {gradeGroups.map((grade) => (
            <div key={grade.id}>
              <h2 className="mb-2.5 text-sm font-black uppercase tracking-widest text-indigo-500 sm:mb-3">{grade.name}</h2>
              <div className="space-y-4 sm:space-y-5">
                {grade.lessons.map((lesson) => (
                  <div key={lesson.id}>
                    <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-muted-foreground">{lesson.name}</h3>
                    <div className="space-y-3 sm:space-y-4">
                      {lesson.units.map((unit) => (
                        <div key={unit.id} className="rounded-2xl border border-default bg-surface-elevated p-3.5 sm:p-4">
                          <p className="mb-2 text-xs font-bold text-muted-foreground">{unit.title}</p>
                          <div className="space-y-1.5">
                            {unit.topics.map((topic) => (
                              <Link
                                key={topic.id}
                                href={topic.path}
                                className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold text-default transition-colors hover:bg-indigo-500/5 hover:text-indigo-500"
                              >
                                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{topic.title}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const title = 'Farklı Konular - Müfredat Dışı Konu Arşivi';
  const description = 'Güncel müfredatta yer almayan, genel kültür amaçlı yayında tutulan konuların arşivi.';

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}
