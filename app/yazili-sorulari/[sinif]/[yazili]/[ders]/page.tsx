// /yazili-sorulari/6-sinif/1-donem-1-yazili/matematik — bir yazılının konu konu klasik soruları, cevap
// anahtarıyla (bkz. docs/yazili-sorulari-plani.md). Sorular herkese açık; cevaplar
// <details> içinde (JS'siz çalışır, arama motoru da okur). Sorusu olmayan yazılı 404 (ince sayfa üretmeyelim).
// 2026-11-01 sadeleştirme (kullanıcı): öğrenci alanı tek panel, YaziliStudy — 1) konu seç, 2) yazılı provası çöz |
// soruları gör (filtre: konu + zorluk). Prova/havuz sekmeleri, konu sekmeleri ve hazır deneme kağıtları kaldırıldı.
// En altta kapalı "Öğretmenler için" (MEB senaryo tablosu, PDF, yazılı hazırla; öğretmene kendiliğinden açılır).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { renderPlainTextMath } from '@/app/src/lib/topicContentV11';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliExam, getYaziliHub, YAZILI_INDEX_PATH } from '@/app/src/lib/yazili/publicData';
import { difficultyBand } from '@/app/src/lib/yazili/papers';
import { SoruBankasiQuickNav } from '@/app/src/components/SoruBankasiQuickNav';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import { YaziliStudy, YAZILI_LIST_CLASS } from '@/app/src/components/yazili/YaziliStudy';
import { YaziliTeacherSection } from '@/app/src/components/yazili/YaziliTeacherSection';
import { YaziliAdminEditProvider, YaziliEditButton } from '@/app/src/components/yazili/YaziliAdminEdit';
import r from '@/app/src/components/robotic/robotic.module.css';
import y from '@/app/src/components/yazili/yazili.module.css';

// Soru eklenince/yazılı yayınlanınca sayfa anında yenilenir (revalidatePath); süre üst sınır.
export const revalidate = 604800;

interface Params {
  sinif: string;
  ders: string;
  yazili: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

function MathHtml({ text, className }: { text: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderPlainTextMath(text) }} />;
}

export default async function YaziliExamPage({ params }: { params: Promise<Params> }) {
  const { sinif, ders, yazili } = await params;
  const [data, hubData] = await Promise.all([getYaziliExam(sinif, ders, yazili), getYaziliHub(sinif, yazili)]);
  if (!data || !data.exam.questionCount) notFound();

  const { exam, topics, scenarios, scenarioCount } = data;
  // Üst sayfa: o sınıfın bu dönem-yazılısı (bütün dersler).
  const hubName = `${data.gradeName} ${exam.label}`;
  const hubPath = hubData?.hub.path ?? YAZILI_INDEX_PATH;
  const title = `${data.gradeName} ${data.lessonName} ${exam.label} Soruları`;
  const topicNames = topics.filter((t) => t.questions.length).map((t) => t.title);
  const intro =
    `${data.gradeName} ${data.lessonName} ${exam.label.toLocaleLowerCase('tr')} için ${joinTr(topicNames)} konularından ` +
    `${exam.questionCount} açık uçlu soru. Her sorunun cevabı var; sorular 2026-2027 MEB ortak yazılı ` +
    (exam.national ? 'sınavının kapsamına göre hazırlandı.' : 'konu-soru dağılım tablosundaki öğrenme çıktılarına göre hazırlandı.');

  // Öğrenci alanı: konu başına soru listesi sunucuda çizilir (SEO), başlık/süzme/numara YaziliStudy'de.
  const shownTopics = topics.filter((t) => t.questions.length);
  const studyTopics = shownTopics.map((t) => ({
    id: t.id,
    title: t.title,
    count: t.questions.length,
    loCodes: t.loCodes,
    bandCounts: {
      kolay: t.questions.filter((q) => difficultyBand(q.difficulty) === 'kolay').length,
      orta: t.questions.filter((q) => difficultyBand(q.difficulty) === 'orta').length,
      zor: t.questions.filter((q) => difficultyBand(q.difficulty) === 'zor').length,
    },
  }));
  const questionPanels = shownTopics.map((t) => (
    <ol key={t.id} className="flex flex-col gap-3">
      {t.questions.map((q, qi) => {
        const n = qi + 1;
        const svg = q.svgContent ? <YaziliSvg svgContent={q.svgContent} /> : null;
        return (
          <li key={q.id} data-zorluk={difficultyBand(q.difficulty)} className={`rounded-2xl p-4 sm:p-5 ${r.item}`}>
            <div className="flex gap-3">
              <span className={`h-8 w-8 shrink-0 text-sm ${r.chipBox} ${y.poolNum}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {q.svgPosition === 'above' && svg}
                <p className="leading-relaxed text-default"><span className="sr-only">Soru {n}: </span><MathHtml text={q.text} /></p>
                {q.svgPosition === 'below' && svg}
                <details className="group mt-3">
                  <summary className={`cursor-pointer select-none text-sm font-semibold ${r.accent}`}>Cevabı göster</summary>
                  <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[var(--edge)] p-3 text-sm">
                    <p><b className="text-default">Cevap:</b> <MathHtml text={q.modelAnswer} className="text-default" /></p>
                    {q.answerSvgContent && <YaziliSvg svgContent={q.answerSvgContent} label={`Soru ${n} cevap görseli`} />}
                  </div>
                </details>
              </div>
              <YaziliEditButton questionId={q.id} />
            </div>
          </li>
        );
      })}
    </ol>
  ));

  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <noscript>
          <style>{`.${YAZILI_LIST_CLASS}{display:block!important}`}</style>
        </noscript>
        <script
          id="structured-data-yazili-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildSoruBankasiBreadcrumbJsonLd([
                { name: 'Yazılı Soruları', path: YAZILI_INDEX_PATH },
                { name: hubName, path: hubPath },
                { name: data.lessonName, path: exam.path },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />

        <SoruBankasiHeader
          crumbs={[
            { name: 'Yazılı Soruları', href: YAZILI_INDEX_PATH },
            { name: hubName, href: hubPath },
          ]}
          lessonName={data.lessonName}
          eyebrow="2026-2027 · MEB ortak yazılıya uygun"
          title={title}
          pills={[
            `${exam.questionCount} soru`,
            'Cevap anahtarlı',
            exam.national ? 'Ülke geneli sınav' : `${scenarioCount} MEB senaryosu`,
          ]}
        >
          {exam.examDate && (
            <p className={`mt-4 text-sm ${r.accent}`}>
              <ExamCountdown examDate={exam.examDate} />
            </p>
          )}
        </SoruBankasiHeader>

        <SoruBankasiQuickNav
          label={`${hubName} dersleri`}
          items={(hubData?.hub.lessons ?? []).map((l) => ({ key: l.exam.id, href: l.exam.path, label: l.name, current: l.exam.id === exam.id }))}
        />

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <div className="flex min-w-0 flex-col gap-8">
            <YaziliAdminEditProvider>
              <YaziliStudy
                topics={studyTopics}
                panels={questionPanels}
                exam={{ sinif, ders, yazili, loOptions: data.loOptions, scenarios, scenarioCount: exam.national ? 0 : scenarioCount }}
              />
            </YaziliAdminEditProvider>

            {/* Tanıtım metni (SEO) en altta (2026-11-02, kullanıcı): telefonda konu seçimini aşağı itmesin. */}
            <section aria-labelledby="yazili-hakkinda" className={`p-5 sm:p-6 ${r.panel}`}>
              <h2 id="yazili-hakkinda" className="text-base font-bold text-default">Bu yazılı hakkında</h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{intro}</p>
            </section>

            <YaziliTeacherSection>
              <section aria-labelledby="kapsam">
                <h3 id="kapsam" className="text-base font-bold text-default">Hangi konudan kaç soru çıkar?</h3>
                {exam.national ? (
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    Bu yazılı <b className="text-default">ülke geneli ortak sınav</b> olarak yapılıyor: soru kitapçığını Millî Eğitim Bakanlığı
                    hazırlayıp okullara gönderiyor, sorular açık uçlu. Kapsamdaki konular: {joinTr(topics.map((t) => t.title))}.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      MEB her öğrenme çıktısından kaç soru sorulacağını {scenarioCount} senaryo olarak yayımladı; okulunuzdaki zümre bunlardan birini seçer.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[30rem] text-sm">
                        <caption className="sr-only">MEB konu-soru dağılımı, senaryo başına soru sayısı</caption>
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th scope="col" className="py-1.5 pr-3 font-semibold">Konu</th>
                            {Array.from({ length: scenarioCount }, (_, i) => (
                              <th key={i} scope="col" className="px-1 text-center font-semibold">{i + 1}. senaryo</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {scenarios.map((s) => (
                            <tr key={s.loCode} className="border-t border-[var(--edge)]">
                              <th scope="row" className="py-2 pr-3 text-left font-medium text-default">
                                {s.topicTitles.join(', ') || s.loCode}
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{s.loCode}</span>
                              </th>
                              {Array.from({ length: scenarioCount }, (_, i) => (
                                <td key={i} className="px-1 text-center">{s.counts[i + 1] ?? '–'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              {/* Öğretmen kazanımı (2026-10-22): bu havuzdan kendi kağıdını kurma → öğretmen paneli. */}
              <section aria-labelledby="ogretmen-cta">
                <h3 id="ogretmen-cta" className="text-base font-bold text-default">Kendi yazılınızı hazırlayın</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bu sorulardan seçin, puanlayın, MEB dağılımına göre kontrol edin; PDF ya da Word indirin.
                </p>
                <Link href={`/ogretmen/yazili?yazili=${exam.id}`} className={`mt-3 inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-bold ${r.btnGhost}`}>
                  Yazılı hazırla →
                </Link>
              </section>
            </YaziliTeacherSection>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Yazılı gezinmesi">
            <SoruBankasiNavList
              id="yazili-dersleri"
              title={`${hubName} dersleri`}
              items={(hubData?.hub.lessons ?? []).map((l) => ({
                key: l.exam.id,
                href: l.exam.path,
                label: l.name,
                meta: `${l.exam.questionCount} soru`,
                lessonName: l.name,
                current: l.exam.id === exam.id,
                isPage: true,
              }))}
            />
            <a href="#ogretmenler-icin" className={`p-4 text-sm ${r.panel}`}>
              <span className="font-bold text-default">Öğretmen misiniz?</span>{' '}
              <span className={r.accent}>Kendi yazılınızı hazırlayın →</span>
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sinif, ders, yazili } = await params;
  const data = await getYaziliExam(sinif, ders, yazili);
  if (!data || !data.exam.questionCount) return { title: 'Yazılı Bulunamadı' };

  const canonicalUrl = `${SITE_URL}${data.exam.path}`;
  const title = `${data.gradeName} ${data.lessonName} ${data.exam.label} Soruları ve Cevapları (2026-2027)`;
  const description =
    `${data.gradeName} ${data.lessonName} ${data.exam.label.toLocaleLowerCase('tr')} soruları: ${joinTr(data.topics.filter((t) => t.questions.length).map((t) => t.title))}. ` +
    `MEB ortak yazılıya uygun ${data.exam.questionCount} açık uçlu soru ve cevap anahtarı.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'article', images: [{ url: '/og-image.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary', title, description },
  };
}
