'use client';

// Konu okuma sayfası v2 (kullanıcının 2026-09-27 isteği; tasarım seçimi için bkz.
// app/src/lib/topicPageDesign.ts). v1 (DersClient.tsx) ile AYNI sunucu verisini ve aynı
// içerik/test/slayt/yorum/admin bileşenlerini kullanır; sadece sunum farklıdır. v1'den
// farkı: konu değişimi sayfa içi state yerine gerçek sayfa geçişiyle (her konu zaten ISR ile
// önbellekli ayrı bir sayfa) — sayfa içi önbellek/prefetch mantığına gerek kalmıyor.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Onest, Unbounded } from 'next/font/google';
import { Sparkles, ChevronDown, X, ListTree, ArrowUp } from 'lucide-react';
import SectionContent from '../SectionContent';
import { TopicCompleteButton, useTopicTest, TopicTestConflictModal, TopicTestErrorModal } from '../DersClientCards';
import { buildSectionSlugs, buildSectionImageAlt, buildTopicHref, buildTopicImageAlt, type Content, type Outcome, type Unit } from '../dersHelpers';
import type { DersClientProps } from '../DersClient';
import AdminTopicToolsHost, { preloadAdminTopicTools, ADMIN_TOOLS_MENU, SECTION_ADMIN_TOOLS_MENU, type AdminToolRequest } from '../AdminTopicToolsHost';
import SlidePlayer from '@/app/src/components/SlidePlayer';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { outcomeLetterAt } from '@/app/src/lib/outcomeCodes';
import { buildSoruBankasiUnitPath } from '@/app/src/lib/soruBankasiPaths';
import TopicSwitcher from './TopicSwitcher';
import s from './DersClientV2.module.css';

const displayFont = Unbounded({ subsets: ['latin', 'latin-ext'], weight: ['500', '700'], variable: '--font-v2-display', display: 'swap' });
const bodyFont = Onest({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-v2-body', display: 'swap' });

const NO_SECTIONS: NonNullable<Content['sections']> = [];

type StepId = 'kavramlar' | 'bolumler' | 'slayt' | 'ozet' | 'test';

type OutcomeGroup = {
  key: string;
  learningOutcome: NonNullable<Outcome['learningOutcome']> | null;
  items: { key: string; letter: string; description: string }[];
};

// Kazanımlar öğrenme çıktısına göre gruplanır ve MEB'in kendi harfiyle (a, b, c…) gösterilir —
// harfler her öğrenme çıktısında baştan başladığı için tek listede yeniden harflendirmek
// kılavuzdaki maddelerle çelişirdi. Harf/öğrenme çıktısı olmayan eski kayıtlarda sıradan üretilir.
function groupOutcomes(outcomes: Outcome[]): OutcomeGroup[] {
  const groups: OutcomeGroup[] = [];
  for (const o of outcomes) {
    const lo = o.learningOutcome ?? null;
    const loId = o.learningOutcomeId ?? lo?.id ?? null;
    const key = loId != null ? `lo-${loId}` : 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, learningOutcome: lo, items: [] };
      groups.push(group);
    }
    const code = o.code?.trim();
    const letter = code && code.length <= 3 ? code : outcomeLetterAt(group.items.length);
    group.items.push({ key: String(o.id ?? `${key}-${group.items.length}`), letter, description: o.description });
  }
  return groups;
}

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

export default function DersClientV2({ initialData, gradeId, lessonId }: DersClientProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { gradeName, lessonName, unitName, gradeSlug, lessonSlug, unitSlug, contents, gradeLessons = [], allGrades = [] } = initialData;

  const topicIndex = Math.max(0, contents.findIndex((c) => c.slug === initialData.topicSlug));
  const topic: Content | undefined = contents[topicIndex];
  const units = useMemo(() => [...(initialData.units || [])].sort((a, b) => a.order_no - b.order_no), [initialData.units]);
  const unitIndex = units.findIndex((u) => u.slug === unitSlug);
  const unit: Unit | undefined = units[unitIndex];

  const sections = topic?.sections ?? NO_SECTIONS;
  const sectionSlugs = useMemo(() => buildSectionSlugs(sections), [sections]);
  const highlights = topic?.highlights ?? [];
  const outcomeGroups = groupOutcomes(initialData.outcomes.filter((o) => topic && String(o.topicId) === String(topic.id)));

  // Konu sınırında bir önceki/sonraki üniteye geçilir (ünite sayfasına, o ünitenin
  // konuları burada yüklü değil).
  const unitHref = (u: Unit | undefined) => (u?.slug && gradeSlug && lessonSlug ? `/${gradeSlug}/${lessonSlug}/${u.slug}` : null);
  const topicHref = (c: Content | undefined) => (c?.slug ? buildTopicHref(gradeSlug, lessonSlug, unitSlug, c.slug) : null);
  const pagerLink = (c: Content | undefined, u: Unit | undefined, dir: 'prev' | 'next') => {
    const cHref = topicHref(c);
    if (c && cHref) return { label: dir === 'prev' ? 'Önceki konu' : 'Sıradaki konu', title: c.title, href: cHref };
    const uHref = unitHref(u);
    if (u && uHref) return { label: dir === 'prev' ? 'Önceki ünite' : 'Sıradaki ünite', title: u.title, href: uHref };
    return null;
  };
  const prev = pagerLink(contents[topicIndex - 1], unitIndex > 0 ? units[unitIndex - 1] : undefined, 'prev');
  const next = pagerLink(contents[topicIndex + 1], unitIndex >= 0 ? units[unitIndex + 1] : undefined, 'next');
  const unitQuestionsHref = unit?.test_question_count && gradeSlug && lessonSlug && unitSlug ? buildSoruBankasiUnitPath(gradeSlug, lessonSlug, unitSlug) : null;

  // ---- Kavrama testi (v1 ile aynı hook) ----
  const topicTest = useTopicTest({
    gradeSlug,
    lessonSlug,
    unitSlug,
    topicSlug: topic?.slug,
    topicId: topic ? Number(topic.id) : null,
    unitId: unit ? Number(unit.id) : null,
  });
  const hasTest = !!topic?.slug && topicTest.status?.poolSize !== 0;
  const testSize = topicTest.status?.testSize ?? null;

  // ---- Slaytlar ----
  const [slideDeck, setSlideDeck] = useState<SlideDeck | null>(null);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [slidesError, setSlidesError] = useState<string | null>(null);
  const [slidesExpanded, setSlidesExpanded] = useState(false);
  const [slidesReloadKey, setSlidesReloadKey] = useState(0);
  const topicId = topic?.id;
  useEffect(() => {
    if (topicId == null) return;
    let cancelled = false;
    fetch(`/api/topics/${topicId}/slides`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) { setSlideDeck(null); setSlidesError(data?.error || 'Bu konu için sunum hazırlanamadı'); return; }
        setSlideDeck(data.deck as SlideDeck);
        setSlidesError(null);
      })
      .catch(() => { if (!cancelled) setSlidesError('Ağ hatası oluştu'); })
      .finally(() => { if (!cancelled) setSlidesLoading(false); });
    return () => { cancelled = true; };
  }, [topicId, slidesReloadKey]);

  // ---- Admin araçları ----
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [sectionMenuId, setSectionMenuId] = useState<string | number | null>(null);
  const [adminTool, setAdminTool] = useState<AdminToolRequest | null>(null);
  useEffect(() => { if (isAdmin) preloadAdminTopicTools(); }, [isAdmin]);
  const closeAdminTool = () => {
    setAdminTool(null);
    // Admin kayıt endpoint'leri konu sayfasını revalidate ediyor — güncel sunucu verisini çek.
    router.refresh();
    setSlidesReloadKey((k) => k + 1);
  };

  // ---- Yorum deep-link vurgusu (DersHighlight.tsx ile aynı olay) ----
  const [discussionTarget, setDiscussionTarget] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string }>).detail?.target;
      if (target) setDiscussionTarget(target);
    };
    window.addEventListener('ders:highlight-comment', handler);
    return () => window.removeEventListener('ders:highlight-comment', handler);
  }, []);

  // ---- Okuma takibi: aktif bölüm, okunanlar, öğrenme yolundaki adım ----
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [activeStep, setActiveStep] = useState<StepId>('kavramlar');
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const partObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const slug = (e.target as HTMLElement).id;
        setActiveSlug(slug);
        setSeen((prev) => (prev.has(slug) ? prev : new Set(prev).add(slug)));
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    const stepObserver = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActiveStep((e.target as HTMLElement).dataset.step as StepId);
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll<HTMLElement>('[data-part]').forEach((el) => partObserver.observe(el));
    document.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => stepObserver.observe(el));
    return () => { partObserver.disconnect(); stepObserver.disconnect(); };
  }, [sections]);

  const activeIndex = sections.findIndex((sec) => sectionSlugs.get(sec.id) === activeSlug);
  const readCount = seen.size;
  const readPct = sections.length ? Math.round((readCount / sections.length) * 100) : 0;

  // ---- Diğer UI durumları ----
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [heroZoomed, setHeroZoomed] = useState(false);
  useEffect(() => {
    if (!switcherOpen && !heroZoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSwitcherOpen(false); setHeroZoomed(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [switcherOpen, heroZoomed]);

  // ---- Başa dön + mobil alt çubuk (kullanıcı istekleri, 2026-09-27) ----
  // Aşağı ok bilerek yok: sayfa içi atlama için öğrenme yolu / içindekiler var. Masaüstünde
  // sağ alt köşede yüzer; mobilde köşe alt çubukla dolu olduğu için çubuğun içinde.
  // Mobil alt çubuk aşağı kaydırırken (okurken) gizlenir, yukarı kaydırınca geri gelir —
  // okuma sırasında ekranı kaplamasın (mobil tarayıcı adres çubuğuyla aynı davranış).
  const [showToTop, setShowToTop] = useState(false);
  const [dockHidden, setDockHidden] = useState(false);
  useEffect(() => {
    let frame = 0;
    let lastY = window.scrollY;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setShowToTop(y > window.innerHeight * 1.5);
      const delta = y - lastY;
      // Küçük titreşimleri (iOS lastik kaydırma, momentum sonu) yok say.
      if (Math.abs(delta) < 8) return;
      const nearBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 80;
      setDockHidden(delta > 0 && y > 120 && !nearBottom);
      lastY = y;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const scrollToTop = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const startTest = () => { void topicTest.startTest(false); };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!topic) return null;

  const steps: { id: StepId; title: string; meta: string; enabled: boolean }[] = [
    { id: 'kavramlar', title: 'Kavramlar', meta: highlights.length ? `${highlights.length} kavram` : 'Hazırlanıyor', enabled: highlights.length > 0 },
    { id: 'bolumler', title: 'Konu anlatımı', meta: sections.length ? `${sections.length} bölüm` : 'Oku', enabled: true },
    { id: 'slayt', title: 'Slayt', meta: slideDeck ? `${slideDeck.slides.length} slayt` : 'Görsel tekrar', enabled: !!slideDeck },
    { id: 'ozet', title: 'Özet', meta: 'Kısa tekrar', enabled: !!(topic.summaryHtml || topic.discussionPromptHtml) },
    { id: 'test', title: 'Kavrama testi', meta: testSize ? `${testSize} soru` : 'Test', enabled: hasTest },
  ];


  return (
    <div className={cx(s.root, displayFont.variable, bodyFont.variable)}>
      <div className={s.wrap}>
        {/* Konum + konu değiştirici + admin menüsü */}
        <div className={s.locRow}>
          <nav className={s.crumbs} aria-label="Konum">
            {gradeSlug && <Link href={`/${gradeSlug}`} className={s.crumbHide}>{gradeName}</Link>}
            <span className={cx(s.crumbSep, s.crumbHide)}>/</span>
            {gradeSlug && lessonSlug && <Link href={`/${gradeSlug}/${lessonSlug}`} className={s.crumbHide}>{lessonName}</Link>}
            <span className={cx(s.crumbSep, s.crumbHide)}>/</span>
            {gradeSlug && lessonSlug && unitSlug ? <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}>{unitName}</Link> : <span>{unitName}</span>}
          </nav>
          <button type="button" className={s.iconBtn} onClick={() => setSwitcherOpen(true)}>
            <ListTree size={15} aria-hidden="true" /> Konu değiştir
          </button>
          {isAdmin && (
            <div className={s.menuWrap}>
              <button type="button" className={s.adminBtn} onClick={() => setAdminMenuOpen((v) => !v)} aria-expanded={adminMenuOpen}>
                <Sparkles size={15} aria-hidden="true" /> İçerik
              </button>
              {adminMenuOpen && (
                <>
                  <div className={s.backdrop} onClick={() => setAdminMenuOpen(false)} />
                  <div className={s.menu} role="menu">
                    <button type="button" className={s.menuItemStrong} onClick={() => { setAdminMenuOpen(false); setAdminTool({ panel: 'all' }); }}>Tüm Araçlar →</button>
                    <div className={s.menuSep} />
                    {ADMIN_TOOLS_MENU.map((item) => (
                      <button key={item.panel} type="button" className={s.menuItem} onClick={() => { setAdminMenuOpen(false); setAdminTool({ panel: item.panel }); }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Hero */}
        <section className={s.stage}>
          <div className={topic.heroImageUrl ? s.stageGrid : s.stageGridNoArt}>
            <div>
              <span className={s.tag}><i className={s.tagDot} aria-hidden="true" />{lessonName} · {gradeName}</span>
              <p className={s.kicker}>
                {unitIndex >= 0 && <b>Ünite {unitIndex + 1} · </b>}{unitName}{contents.length > 1 && ` · Konu ${topicIndex + 1} / ${contents.length}`}
              </p>
              <h1 className={s.h1}>{topic.title}</h1>
              {topic.subtitle && <p className={s.lead}>{topic.subtitle}</p>}
              {outcomeGroups.length > 0 && (
                <section className={s.outcomes} aria-labelledby="kazanimlar-baslik">
                  <h2 id="kazanimlar-baslik" className={s.outcomesTitle}>Kazanımlar</h2>
                  {outcomeGroups.map((g) => (
                    <div key={g.key} className={s.outcomeGroup}>
                      {g.learningOutcome && (
                        <p className={s.learningOutcome}>
                          {g.learningOutcome.code && <span className={s.learningOutcomeCode}>{g.learningOutcome.code}</span>}
                          {g.learningOutcome.title}
                        </p>
                      )}
                      <ol className={s.outcomeList}>
                        {g.items.map((o) => (
                          <li key={o.key} className={s.outcome}><span className={s.outcomeTag}>{o.letter})</span><span>{o.description}</span></li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </section>
              )}
              {topic.isArchived && <p className={s.archived}>Bu konu güncel müfredatta yer almıyor; içerik arşiv olarak duruyor.</p>}
              <div className={s.heroActions}>
                <button type="button" className={s.btnPrimary} onClick={() => scrollTo(highlights.length ? 'kavramlar' : 'bolumler')}>
                  Konuya başla <span className={s.arr} aria-hidden="true">→</span>
                </button>
                {hasTest && (
                  <button type="button" className={s.btnSoft} onClick={startTest} disabled={topicTest.loading}>
                    {topicTest.loading ? 'Test açılıyor…' : 'Kavrama testi'}
                  </button>
                )}
              </div>
            </div>
            {topic.heroImageUrl && (
              <figure className={s.art}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={topic.heroImageUrl}
                  alt={buildTopicImageAlt(topic.title, lessonName, gradeName, topic.heroImageAlt)}
                  className={s.artImg}
                  onClick={() => setHeroZoomed(true)}
                />
              </figure>
            )}
          </div>
        </section>

        {/* Öğrenme yolu */}
        <ol className={s.path} aria-label="Öğrenme yolu">
          {steps.map((step, i) => {
            const now = step.id === activeStep;
            const stepIdx = steps.findIndex((x) => x.id === activeStep);
            return (
              <li key={step.id} className={cx(s.pathItem, now && s.pathNow, !now && i < stepIdx && step.enabled && s.pathDone)}>
                <button
                  type="button"
                  className={s.pathBtn}
                  disabled={!step.enabled}
                  aria-current={now ? 'step' : undefined}
                  onClick={() => {
                    // Test ve slayt sayfada aşağı kaydırmak yerine doğrudan açılır pencerede açılır
                    // (kullanıcının 2026-09-27 isteği); diğer adımlar ilgili bölüme kaydırır.
                    if (step.id === 'test') startTest();
                    else if (step.id === 'slayt') setSlidesExpanded(true);
                    else scrollTo(step.id);
                  }}
                >
                  <span className={s.node}>{!now && i < stepIdx && step.enabled ? '✓' : i + 1}</span>
                  <span className={s.stepTitle}>{step.title}</span>
                  <span className={s.stepMeta}>{now ? 'Buradasın' : step.meta}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Kavramlar */}
        {highlights.length > 0 && (
          <section className={s.block} id="kavramlar" data-step="kavramlar">
            <div className={s.blockHead}>
              <div><p className={s.eyebrow}>Adım 1 · {highlights.length} kavram</p><h2 className={s.h2}>Önce kavramları tanı</h2></div>
              <p>Konu boyunca bu kavramlar sık geçecek. Metinde kalın yazılan terimler fosforlu kalemle işaretli.</p>
            </div>
            <dl className={s.bento}>
              {highlights.map((h, i) => (
                <div
                  key={`${h.title}-${i}`}
                  className={cx(s.entry, highlights.length % 2 === 1 && i === highlights.length - 1 && s.entryWide)}
                >
                  <dt>{h.title}</dt><dd>{h.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Konu anlatımı */}
        <div className={s.reader} id="bolumler" data-step="bolumler">
          {sections.length > 0 && (
            <aside className={s.toc} aria-label="Bu konudaki bölümler">
              <div className={s.tocTop}>
                <span className={s.ring} style={{ background: `conic-gradient(var(--lesson) 0 ${readPct}%, var(--line) 0 100%)` }} aria-hidden="true" />
                <div><b>{readCount} / {sections.length} bölüm</b><span>okundu</span></div>
              </div>
              <ol className={s.tocList}>
                {sections.map((sec, i) => {
                  const slug = sectionSlugs.get(sec.id) || String(sec.id);
                  const active = slug === activeSlug;
                  const read = !active && seen.has(slug) && i < activeIndex;
                  return (
                    <li key={sec.id}>
                      <a href={`#${slug}`} className={cx(s.tocLink, active && s.tocActive, read && s.tocRead)} aria-current={active ? 'location' : undefined}>
                        <span className={s.tocNo}>{read ? '✓' : String(i + 1).padStart(2, '0')}</span>
                        <span>{sec.heading}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
              {hasTest && (
                <button type="button" className={cx(s.btnPrimary, s.tocCta)} onClick={startTest} disabled={topicTest.loading}>
                  Teste geç <span className={s.arr} aria-hidden="true">→</span>
                </button>
              )}
            </aside>
          )}

          <article className={s.article}>
            {sections.length > 0 ? (
              sections.map((sec, i) => {
                const slug = sectionSlugs.get(sec.id) || String(sec.id);
                const hasBody = !!(sec.html || sec.imageUrl || sec.diagramSvg || sec.videoUrl);
                return (
                  <section key={sec.id} id={slug} data-part data-section-anchor={slug} className={cx(s.part, slug === activeSlug && s.partActive)}>
                    <div className={s.partHead}>
                      <span className={s.partNo} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <p className={s.partKicker}>Bölüm {i + 1} / {sections.length}</p>
                        <h2 className={s.partTitle}>{sec.heading}</h2>
                      </div>
                      {isAdmin && (
                        <div className={s.menuWrap}>
                          <button
                            type="button"
                            className={s.adminBtn}
                            aria-label={`${sec.heading} için içerik araçları`}
                            onClick={() => setSectionMenuId((id) => (id === sec.id ? null : sec.id))}
                          >
                            <Sparkles size={14} aria-hidden="true" /><ChevronDown size={14} aria-hidden="true" />
                          </button>
                          {sectionMenuId === sec.id && (
                            <>
                              <div className={s.backdrop} onClick={() => setSectionMenuId(null)} />
                              <div className={s.menu} role="menu">
                                {SECTION_ADMIN_TOOLS_MENU.map((item) => (
                                  <button
                                    key={item.panel}
                                    type="button"
                                    className={s.menuItem}
                                    onClick={() => { setSectionMenuId(null); setAdminTool({ panel: item.panel, sectionId: Number(sec.id) }); }}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {hasBody ? (
                      <div className={s.prose}>
                        <SectionContent
                          html={sec.html || ''}
                          notebookHtml={sec.notebookHtml}
                          activityPromptHtml={sec.activityPromptHtml}
                          activityExampleHtml={sec.activityExampleHtml}
                          sectionId={sec.id}
                          heading={sec.heading}
                          imageUrl={sec.imageUrl}
                          caption={sec.heading}
                          imageAlt={buildSectionImageAlt(sec.heading, topic.title, lessonName, gradeName, sec.imageAlt)}
                          diagramSvg={sec.diagramSvg}
                          videoUrl={sec.videoUrl}
                          videoType={sec.videoType}
                        />
                      </div>
                    ) : (
                      <p className={s.pending}>İçerik hazırlanıyor.</p>
                    )}
                  </section>
                );
              })
            ) : topic.content ? (
              <div className={s.prose}><SectionContent html={topic.content} /></div>
            ) : (
              <p className={s.pending}>Bu konunun anlatımı hazırlanıyor.</p>
            )}
            <div className={s.complete}><TopicCompleteButton topicId={topic.id} /></div>
          </article>
        </div>

        {/* Slayt */}
        {(slideDeck || slidesLoading || (isAdmin && slidesError)) && (
          <section className={s.block} id="slayt" data-step="slayt">
            <div className={s.blockHead}>
              <div><p className={s.eyebrow}>Adım 3 · Görsel tekrar</p><h2 className={s.h2}>Slaytlarla tekrar et</h2></div>
              <p>Konuyu kısa maddelerle, sunum gibi baştan sona gözden geçir.</p>
            </div>
            <div className={s.slides}>
              {slideDeck ? (
                <SlidePlayer
                  deck={slideDeck}
                  topicId={Number(topic.id)}
                  gradeId={Number(gradeId)}
                  lessonId={Number(lessonId)}
                  unitId={unit ? Number(unit.id) : null}
                  variant="embedded"
                  onExpand={() => setSlidesExpanded(true)}
                />
              ) : slidesLoading ? (
                <div className={s.slideLoading}>Slaytlar yükleniyor…</div>
              ) : (
                <p className={s.slideNote}>Bu konu için slayt yok: {slidesError}</p>
              )}
            </div>
          </section>
        )}

        {/* Özet + düşün ve yorumla */}
        {(topic.summaryHtml || topic.discussionPromptHtml) && (
          <div className={cx(s.block)} id="ozet" data-step="ozet">
            <div className={s.wrapup}>
              {topic.summaryHtml && (
                <section className={s.panel}>
                  <p className={s.eyebrow}>Adım 4</p>
                  <h2 className={s.panelTitle}>Özet</h2>
                  <div className={s.prose} dangerouslySetInnerHTML={{ __html: topic.summaryHtml }} />
                </section>
              )}
              {topic.discussionPromptHtml && (
                <section className={s.think}>
                  <p className={s.eyebrow}>Düşün ve yorumla</p>
                  <div className={s.thinkPrompt} dangerouslySetInnerHTML={{ __html: topic.discussionPromptHtml }} />
                  <div>
                    <button type="button" className={s.btnPrimary} onClick={() => scrollTo('konu-tartisma')}>
                      Cevabını yaz <span className={s.arr} aria-hidden="true">→</span>
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* Test */}
        {hasTest && (
          <section className={s.cta} id="test" data-step="test">
            <div className={s.bigNum}>{testSize ?? '…'}<small>soru</small></div>
            <div>
              <h2 className={s.ctaTitle}>Ne kadar anladın?</h2>
              <p className={s.ctaText}>Kavrama testiyle kendini dene. Yarım bıraktığın test kaldığın yerden devam eder.</p>
            </div>
            <button type="button" className={cx(s.btnPrimary, s.ctaBtn)} onClick={startTest} disabled={topicTest.loading}>
              {topicTest.loading ? 'Açılıyor…' : topicTest.status?.resumable ? 'Teste devam et' : 'Testi başlat'} <span className={s.arr} aria-hidden="true">→</span>
            </button>
          </section>
        )}

        {(prev || next) && (
          <nav className={s.pager} aria-label="Konular arası geçiş">
            {prev && (
              <Link href={prev.href} className={cx(s.next, s.prev)} rel="prev">
                <span className={s.go} aria-hidden="true">←</span>
                <span><small>{prev.label}</small><strong>{prev.title}</strong></span>
              </Link>
            )}
            {next && (
              <Link href={next.href} className={cx(s.next, s.nextEnd)} rel="next">
                <span><small>{next.label}</small><strong>{next.title}</strong></span>
                <span className={s.go} aria-hidden="true">→</span>
              </Link>
            )}
          </nav>
        )}

        {/* Konu değiştir penceresi sadece gezinme için; ünitenin soruları konu bitince burada. */}
        {unitQuestionsHref && unit && (
          <Link href={unitQuestionsHref} className={cx(s.next, s.unitQuestions)}>
            <span><small>Bu ünitenin soruları · {unit.test_question_count} soru</small><strong>{unit.title}</strong></span>
            <span className={s.go} aria-hidden="true">→</span>
          </Link>
        )}

        {/* Yorumlar + AI'ya soru */}
        {unit && (
          <div id="konu-tartisma" className={s.discussion}>
            <UnitDiscussion
              gradeId={Number(gradeId)}
              lessonId={Number(lessonId)}
              unitId={Number(unit.id)}
              unitName={unitName}
              topicId={Number(topic.id)}
              topicName={topic.title}
              defaultExpanded
              isAdmin={isAdmin}
              highlightTarget={discussionTarget}
            />
          </div>
        )}

        <footer className={s.facts}>
          {topicTest.status?.poolSize ? <span className={s.fact}>Bu konu <b>{topicTest.status.poolSize}</b> soru</span> : null}
          {unit?.test_question_count ? <span className={s.fact}>Ünite <b>{unit.test_question_count}</b> soru</span> : null}
          {unit?.start_week != null && (
            <span className={s.fact}>MEB takvimi <b>{unit.start_week}{unit.end_week && unit.end_week !== unit.start_week ? `–${unit.end_week}` : ''}.</b> hafta</span>
          )}
        </footer>
      </div>

      {/* Mobil alt çubuk */}
      <div className={cx(s.dock, dockHidden && s.dockHidden)} role="region" aria-label="Konu ilerlemesi" inert={dockHidden}>
        <div className={s.dockText}>
          <span>{activeIndex >= 0 ? `Bölüm ${activeIndex + 1} / ${sections.length}` : unitName}</span>
          <strong>{activeIndex >= 0 ? sections[activeIndex].heading : topic.title}</strong>
        </div>
        {showToTop && (
          <button type="button" className={s.dockTop} onClick={scrollToTop} aria-label="Sayfanın başına dön" title="Başa dön">
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        )}
        {hasTest ? (
          <button type="button" className={cx(s.btnPrimary, s.dockBtn)} onClick={startTest} disabled={topicTest.loading}>Teste başla</button>
        ) : (
          <button type="button" className={cx(s.btnPrimary, s.dockBtn)} onClick={() => setSwitcherOpen(true)}>Konular</button>
        )}
      </div>

      <button
        type="button"
        className={cx(s.toTop, showToTop && s.toTopVisible)}
        onClick={scrollToTop}
        aria-label="Sayfanın başına dön"
        title="Başa dön"
        aria-hidden={!showToTop}
        tabIndex={showToTop ? 0 : -1}
      >
        <ArrowUp size={20} aria-hidden="true" />
      </button>

      {/* Konu değiştirici */}
      {switcherOpen && (
        <TopicSwitcher
          className={cx(displayFont.variable, bodyFont.variable)}
          grades={allGrades.filter((g) => g.slug)}
          gradeLessons={gradeLessons}
          units={units}
          contents={contents}
          current={{ gradeId: Number(gradeId), lessonId: Number(lessonId), unitId: unit?.id ?? null, topicId: topic ? Number(topic.id) : null }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}

      {/* Portallar: kapak görseli, slayt tam ekran, test, admin araçları */}
      {heroZoomed && topic.heroImageUrl && createPortal(
        <div className={s.zoom} onClick={() => setHeroZoomed(false)} role="dialog" aria-modal="true" aria-label="Kapak görseli">
          <div className={s.zoomFrame} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={s.zoomClose} onClick={() => setHeroZoomed(false)} aria-label="Kapat">
              <X size={16} aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={topic.heroImageUrl} alt={buildTopicImageAlt(topic.title, lessonName, gradeName, topic.heroImageAlt)} className={s.zoomImg} />
          </div>
        </div>,
        document.body
      )}
      {slidesExpanded && slideDeck && createPortal(
        <SlidePlayer
          deck={slideDeck}
          topicId={Number(topic.id)}
          gradeId={Number(gradeId)}
          lessonId={Number(lessonId)}
          unitId={unit ? Number(unit.id) : null}
          onClose={() => setSlidesExpanded(false)}
        />,
        document.body
      )}
      {topicTest.testData && !topicTest.testData.conflict && createPortal(
        <QuizWithAsk
          presentation="player"
          key={topicTest.testData.resume?.sessionId ?? 'new'}
          gradeId={topicTest.testData.gradeId}
          lessonId={topicTest.testData.lessonId}
          unitId={topicTest.testData.unitId}
          topicId={topicTest.testData.topicId}
          scopeLabel={topicTest.testData.scopeLabel}
          exitHref={topicTest.testHref}
          exitLabel="Kapat"
          onExit={topicTest.closeTest}
          initialQuestions={topicTest.testData.initialQuestions}
          remainingQuestionIds={topicTest.testData.remainingQuestionIds}
          allCaughtUp={topicTest.testData.allCaughtUp}
          reloadEndpoint={topicTest.testData.reloadEndpoint}
          secondsPerQuestion={topicTest.testData.secondsPerQuestion ?? undefined}
          resume={topicTest.testData.resume}
          questionBankPathBase={topicTest.testData.questionBankPathBase}
        />,
        document.body
      )}
      {topicTest.testData?.conflict && createPortal(
        <TopicTestConflictModal
          conflict={topicTest.testData.conflict}
          loading={topicTest.loading}
          onStartNew={() => topicTest.startTest(true)}
          onClose={topicTest.closeTest}
        />,
        document.body
      )}
      {topicTest.error && createPortal(<TopicTestErrorModal message={topicTest.error} onClose={topicTest.closeTest} />, document.body)}
      {isAdmin && adminTool && <AdminTopicToolsHost topicId={Number(topic.id)} request={adminTool} onClose={closeAdminTool} />}
    </div>
  );
}
