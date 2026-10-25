// /yazili-sorulari/6-sinif/matematik/1-donem-1-yazili — bir yazılının konu konu klasik soruları, cevap
// anahtarı ve puanlama ölçütüyle (bkz. docs/yazili-sorulari-plani.md). Sorular herkese açık; cevaplar
// <details> içinde (JS'siz çalışır, arama motoru da okur). Sorusu olmayan yazılı 404 (ince sayfa üretmeyelim).
// 2026-10-25 düzeni öğrenci önce: deneme sınavı (örnek kağıtlar) → sekmeli konu havuzu → en altta kapalı
// "Öğretmenler için" (MEB senaryo tablosu, PDF, yazılı hazırla; öğretmene kendiliğinden açılır).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { renderPlainTextMath } from '@/app/src/lib/topicContentV11';
import { buildSoruBankasiBreadcrumbJsonLd } from '@/app/src/lib/soruBankasiPageData';
import { getYaziliExam, YAZILI_INDEX_PATH, yaziliLessonPath } from '@/app/src/lib/yazili/publicData';
import { SoruBankasiHeader, joinTr, pageInnerCls, pageShellCls } from '@/app/src/components/SoruBankasiHeader';
import { SoruBankasiNavList } from '@/app/src/components/SoruBankasiNavList';
import { ExamCountdown } from '@/app/src/components/yazili/ExamCountdown';
import { YaziliSvg } from '@/app/src/components/yazili/YaziliSvg';
import { PaperDownloads } from '@/app/src/components/yazili/PaperDownloads';
import { YaziliPracticeExam, type PracticePaper } from '@/app/src/components/yazili/YaziliPracticeExam';
import { YaziliTopicTabs, YAZILI_TOPIC_PANEL_CLASS } from '@/app/src/components/yazili/YaziliTopicTabs';
import { YaziliTeacherSection } from '@/app/src/components/yazili/YaziliTeacherSection';
import { YaziliAdminEditProvider, YaziliEditButton } from '@/app/src/components/yazili/YaziliAdminEdit';
import r from '@/app/src/components/robotic/robotic.module.css';

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
  const data = await getYaziliExam(sinif, ders, yazili);
  if (!data || !data.exam.questionCount) notFound();

  const { exam, topics, scenarios, scenarioCount, papers } = data;
  const pdfBase = `/api/yazili-pdf/${data.gradeSlug}/${data.lessonSlug}/${yazili}`;
  const questionById = new Map(topics.flatMap((t) => t.questions).map((q) => [q.id, q]));
  const paperGroups = [...new Set(papers.map((p) => p.scenario ?? 0))].map((s) => ({
    scenario: s,
    a: papers.find((p) => (p.scenario ?? 0) === s && p.variant === 1)!,
    hasB: papers.some((p) => (p.scenario ?? 0) === s && p.variant === 2),
  }));

  // Deneme sınavları: eksiksiz kağıtlar (havuz yetmediyse hepsi), senaryo → A/B sırasıyla.
  const completePapers = papers.filter((p) => p.complete);
  const practicePapers: PracticePaper[] = (completePapers.length ? completePapers : papers)
    .slice()
    .sort((a, b) => (a.scenario ?? 0) - (b.scenario ?? 0) || a.variant - b.variant)
    .map((p, i) => ({
      key: `${p.scenario ?? 0}-${p.variant}`,
      label: `Deneme ${i + 1}`,
      detail: `${p.scenario ? `MEB ${p.scenario}. senaryo` : 'Ülke geneli sınav kapsamı'} · ${p.variant === 1 ? 'A' : 'B'} kağıdı`,
      items: p.items.flatMap((it) => {
        const q = questionById.get(it.questionId);
        return q
          ? [{
              id: q.id,
              points: it.points,
              textHtml: renderPlainTextMath(q.text),
              svg: q.svgContent,
              svgPosition: q.svgPosition,
              answerHtml: renderPlainTextMath(q.modelAnswer),
              answerSvg: q.answerSvgContent,
              rubric: q.rubric,
            }]
          : [];
      }),
    }))
    .filter((p) => p.items.length);
  const title = `${data.gradeName} ${data.lessonName} ${exam.label} Soruları`;
  const lessonPath = yaziliLessonPath(data.gradeSlug, data.lessonSlug);
  const topicNames = topics.filter((t) => t.questions.length).map((t) => t.title);
  const intro =
    `${data.gradeName} ${data.lessonName} ${exam.label.toLocaleLowerCase('tr')} için ${joinTr(topicNames)} konularından ` +
    `${exam.questionCount} açık uçlu soru. Her sorunun cevabı ve puanlama ölçütü var; sorular 2026-2027 MEB ortak yazılı ` +
    (exam.national ? 'sınavının kapsamına göre hazırlandı.' : 'konu-soru dağılım tablosundaki öğrenme çıktılarına göre hazırlandı.');

  // Konu havuzu sekmeli (2026-10-25): soru numarası her konuda 1'den başlar.
  const shownTopics = topics.filter((t) => t.questions.length);
  return (
    <div className={pageShellCls}>
      <div className={pageInnerCls}>
        <noscript>
          <style>{`.${YAZILI_TOPIC_PANEL_CLASS}{display:block!important}`}</style>
        </noscript>
        <script
          id="structured-data-yazili-breadcrumb"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildSoruBankasiBreadcrumbJsonLd([
                { name: 'Yazılı Soruları', path: YAZILI_INDEX_PATH },
                { name: `${data.gradeName} ${data.lessonName}`, path: lessonPath },
                { name: exam.label, path: exam.path },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />

        <SoruBankasiHeader
          crumbs={[
            { name: 'Yazılı Soruları', href: YAZILI_INDEX_PATH },
            { name: `${data.gradeName} ${data.lessonName}`, href: lessonPath },
          ]}
          lessonName={data.lessonName}
          eyebrow="2026-2027 · MEB ortak yazılıya uygun"
          title={title}
          pills={[
            `${exam.questionCount} soru`,
            'Cevap anahtarlı',
            'Puanlama ölçütlü',
            exam.national ? 'Ülke geneli sınav' : `${scenarioCount} MEB senaryosu`,
          ]}
          intro={intro}
        >
          {exam.examDate && (
            <p className={`mt-4 text-sm ${r.accent}`}>
              <ExamCountdown examDate={exam.examDate} />
            </p>
          )}
        </SoruBankasiHeader>

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-x-8">
          <div className="flex min-w-0 flex-col gap-8">
            {/* Öğrenci önce (2026-10-25): deneme sınavı → konu konu havuz → en altta öğretmen bölümü. */}
            {practicePapers.length > 0 && <YaziliPracticeExam papers={practicePapers} />}

            <section aria-labelledby="soru-havuzu" className="flex flex-col gap-4">
              <div>
                <p className={r.label}>Soru havuzu</p>
                <h2 id="soru-havuzu" className={`mt-1 text-xl font-bold uppercase text-default sm:text-2xl ${r.display}`}>
                  Konu konu tüm sorular
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {exam.questionCount} soru, {shownTopics.length} konu. Bir konu seç, soruyu çöz, sonra cevabını aç.
                </p>
              </div>
              <YaziliAdminEditProvider>
                <YaziliTopicTabs
                  tabs={shownTopics.map((t) => ({ id: t.id, label: t.title, count: t.questions.length }))}
                  panels={shownTopics.map((t) => (
                    <section key={t.id} id={`konu-${t.id}`} aria-labelledby={`konu-baslik-${t.id}`} className="flex flex-col gap-3">
                      <h3 id={`konu-baslik-${t.id}`} className={`text-lg font-bold uppercase text-default ${r.display}`}>
                        {t.title}
                        <span className="ml-2 align-middle text-sm font-semibold normal-case text-muted-foreground">{t.questions.length} soru</span>
                      </h3>
                      <ol className="flex flex-col gap-3">
                        {t.questions.map((q, qi) => {
                          const n = qi + 1;
                          const svg = q.svgContent ? <YaziliSvg svgContent={q.svgContent} /> : null;
                          return (
                            <li key={q.id} className={`rounded-2xl p-4 sm:p-5 ${r.item}`}>
                              <div className="flex gap-3">
                                <span className={`h-8 w-8 shrink-0 text-sm ${r.chipBox}`} aria-hidden="true">{n}</span>
                                <div className="min-w-0 flex-1">
                                  {q.svgPosition === 'above' && svg}
                                  <p className="leading-relaxed text-default"><span className="sr-only">Soru {n}: </span><MathHtml text={q.text} /></p>
                                  {q.svgPosition === 'below' && svg}
                                  <details className="group mt-3">
                                    <summary className={`cursor-pointer select-none text-sm font-semibold ${r.accent}`}>Cevabı göster</summary>
                                    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-[var(--edge)] p-3 text-sm">
                                      <p><b className="text-default">Cevap:</b> <MathHtml text={q.modelAnswer} className="text-default" /></p>
                                      {q.answerSvgContent && <YaziliSvg svgContent={q.answerSvgContent} label={`Soru ${n} cevap görseli`} />}
                                      {q.rubric && (
                                        <p className="whitespace-pre-line text-muted-foreground"><b className="text-default">Puanlama:</b> {q.rubric}</p>
                                      )}
                                      {q.keyTerms.length > 0 && (
                                        <p className="text-muted-foreground"><b className="text-default">Anahtar kavramlar:</b> {q.keyTerms.join(', ')}</p>
                                      )}
                                    </div>
                                  </details>
                                </div>
                                <YaziliEditButton questionId={q.id} />
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
                />
              </YaziliAdminEditProvider>
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

              {paperGroups.length > 0 && (
                <section aria-labelledby="kagitlar">
                  <h3 id="kagitlar" className="text-base font-bold text-default">Yazdırılabilir sınav kağıtları</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {exam.national
                      ? 'Kapsamdaki konulardan dengeli seçilmiş, puanları toplam 100 olan kağıt (yukarıdaki deneme sınavlarıyla aynı).'
                      : 'Her kağıt MEB senaryosundaki soru dağılımına birebir uyar; puanlar toplam 100. Soru havuzu yettiğinde her senaryo için A ve B olmak üzere iki farklı soru seti var.'}
                  </p>
                  <ul className="mt-3 flex flex-col gap-3">
                    {paperGroups.map(({ scenario, a, hasB }) => (
                      <li key={scenario} className={`flex flex-col gap-3 rounded-2xl p-4 ${r.item}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-bold text-default">{scenario ? `${scenario}. senaryo` : 'Örnek sınav'}</span>
                          <span className="text-sm text-muted-foreground">{a.items.length} soru · 100 puan</span>
                        </div>
                        <PaperDownloads pdfBase={pdfBase} scenario={scenario} hasB={hasB} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

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
              id="yazililar"
              title={`${data.gradeName} ${data.lessonName} yazılıları`}
              items={data.siblings.map((s) => ({
                key: s.id,
                href: s.path,
                label: s.label,
                meta: `${s.questionCount} soru`,
                badge: `${s.term}·${s.examNo}`,
                lessonName: data.lessonName,
                current: s.id === exam.id,
                isPage: true,
              }))}
            />
            <SoruBankasiNavList
              id="konular"
              title="Bu yazılının konuları"
              items={shownTopics.map((t) => ({
                key: t.id,
                href: `#konu-${t.id}`,
                label: t.title,
                meta: `${t.questions.length} soru`,
                lessonName: data.lessonName,
                current: false,
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
    `MEB ortak yazılıya uygun ${data.exam.questionCount} açık uçlu soru, cevap anahtarı ve puanlama ölçütü.`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: { title, description, url: canonicalUrl, siteName: 'Ders Takip', locale: 'tr_TR', type: 'article', images: [{ url: '/og-image.png', width: 1200, height: 630 }] },
    twitter: { card: 'summary', title, description },
  };
}
