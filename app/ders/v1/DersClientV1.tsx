'use client';

// Konu okuma sayfası v1 (2026-10-19 — tek konu sayfası tasarımı; eski v1/v2/v6 kodları silindi,
// gerekirse git geçmişinde). Dijital tasarım: hero (açık temada açık, koyu temada koyu), solda sabit
// Çalışma Paneli (okuma ilerlemesi + öğrenme yolu + bölümler), sağda sabit "Konu araçları" kartı
// (geniş ekran; dar ekranda hero altındaki araç çubuğu). Konu değişimi gerçek sayfa geçişiyle (her
// konu ISR ile önbellekli ayrı bir sayfa).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  Library,
  ListChecks,
  ListTree,
  MessageCircle,
  Presentation,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import SectionContent from '../SectionContent';
import { TopicCompleteButton, useTopicTest, TopicTestConflictModal, TopicTestErrorModal } from '../DersClientCards';
import { buildSectionSlugs, buildSectionImageAlt, buildTopicHref, buildTopicImageAlt, type Content, type GradeLesson, type GradeOption, type Outcome, type Unit } from '../dersHelpers';
import { formatWeekDateRangeLabel, type CurriculumBreak } from '@/app/src/lib/routeParsing';
import AdminTopicToolsHost, { preloadAdminTopicTools, ADMIN_TOOLS_MENU, SECTION_ADMIN_TOOLS_MENU, type AdminToolRequest } from '../AdminTopicToolsHost';
import SlidePlayer from '@/app/src/components/SlidePlayer';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { outcomeLetterAt } from '@/app/src/lib/outcomeCodes';
import { buildSoruBankasiUnitPath } from '@/app/src/lib/soruBankasiPaths';
import TopicSwitcher from './TopicSwitcher';
import s from './DersClientV1.module.css';

// Konu sayfasının sunucudan aldığı veri (bkz. app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx).
export interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: Outcome[];
    contents: Content[];
    units?: Unit[];
    // Konu değiştir penceresi için: o sınıftaki tüm aktif dersler ve yayındaki tüm sınıflar.
    gradeLessons?: GradeLesson[];
    allGrades?: GradeOption[];
    totalWeeks: number;
    termStartDate?: string | null;
    termEndDate?: string | null;
    breaks?: CurriculumBreak[];
    gradeSlug: string | null;
    lessonSlug: string | null;
    unitSlug: string | null;
    topicTitle: string | null;
    topicSlug: string | null;
  };
  gradeId: string;
  lessonId: string;
  week: number;
}

const NarrationPlayer = dynamic(() => import('@/app/src/components/narration/NarrationPlayer'), { ssr: false });
const InteractiveLessonPlayer = dynamic(() => import('@/app/src/components/interactive/InteractiveLessonPlayer'), { ssr: false });

const displayFont = Space_Grotesk({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-v1-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-v1-body', display: 'swap' });
const monoFont = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-v1-mono', display: 'swap' });

const NO_SECTIONS: NonNullable<Content['sections']> = [];

// Öğrenme yolu yalnız okuma adımları (kullanıcı isteği 2026-10-19); slayt ve test sağdaki araç kartında.
type StepId = 'kavramlar' | 'bolumler' | 'ozet';

type OutcomeGroup = {
  key: string;
  learningOutcome: NonNullable<Outcome['learningOutcome']> | null;
  items: { key: string; letter: string; description: string }[];
};

// Kazanımlar öğrenme çıktısına göre gruplanır, MEB'in kendi harfiyle gösterilir.
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

function nearestWeekIndex(weeks: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < weeks.length; i++) {
    if (Math.abs(weeks[i] - target) < Math.abs(weeks[best] - target)) best = i;
  }
  return best;
}

// Kazanımlar kartı: her kazanım yalnızca işleneceği hafta(lar)da görünür.
function OutcomeWeekCard({ outcomes, currentWeek, totalWeeks, termStartDate, breaks }: {
  outcomes: Outcome[];
  currentWeek: number;
  totalWeeks: number;
  termStartDate: string | null;
  breaks: CurriculumBreak[];
}) {
  const weeks = useMemo(() => {
    if (outcomes.some((o) => !o.weekRanges?.length)) return [];
    const set = new Set<number>();
    for (const o of outcomes) {
      for (const r of o.weekRanges ?? []) {
        for (let w = r.start; w <= r.end; w++) set.add(w);
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [outcomes]);
  const [index, setIndex] = useState(() => nearestWeekIndex(weeks, currentWeek));
  const week = weeks.length ? weeks[index] : null;
  const dateLabel = week != null && termStartDate ? formatWeekDateRangeLabel(week, week, totalWeeks, termStartDate, breaks) : null;

  const groups = useMemo(
    () => groupOutcomes(week == null ? outcomes : outcomes.filter((o) => (o.weekRanges ?? []).some((r) => week >= r.start && week <= r.end))),
    [outcomes, week]
  );

  return (
    <section className={s.card} aria-labelledby="kazanimlar-baslik">
      <div className={s.cardHead}>
        <div>
          <p className={s.label}>MEB kazanımları</p>
          <h2 id="kazanimlar-baslik" className={s.cardTitle}>Bu konuda neler öğreneceksin?</h2>
        </div>
        {week != null && (
          <div className={s.weekNav}>
            <button type="button" className={s.roundBtn} onClick={() => setIndex((i) => i - 1)} disabled={index === 0} aria-label="Önceki hafta">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <span className={s.weekLabel} aria-live="polite">
              <span className={s.weekTitle}>
                {week}. Hafta
                {week === currentWeek && <span className={s.badge}>Bu hafta</span>}
              </span>
              {dateLabel && <span className={s.weekDate}>{dateLabel}</span>}
            </span>
            <button type="button" className={s.roundBtn} onClick={() => setIndex((i) => i + 1)} disabled={index === weeks.length - 1} aria-label="Sonraki hafta">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className={s.outcomeGroups}>
        {groups.map((g) => (
          <div key={g.key} className={s.outcomeGroup}>
            {g.learningOutcome && (
              <p className={s.learningOutcome}>
                {g.learningOutcome.code && <span className={s.code}>{g.learningOutcome.code}</span>}
                {g.learningOutcome.title}
              </p>
            )}
            <ol className={s.outcomeList}>
              {g.items.map((o) => (
                <li key={o.key} className={s.outcome}>
                  <span className={s.outcomeTag}>{o.letter}</span>
                  <span>{o.description}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(' ');
}

type Tool = {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  disabled?: boolean;
};

export default function DersClientV1({ initialData, gradeId, lessonId, week }: DersClientProps) {
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
  const topicOutcomes = initialData.outcomes.filter((o) => topic && String(o.topicId) === String(topic.id));

  // Konu sınırında bir önceki/sonraki üniteye geçilir.
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

  // ---- Kavrama testi ----
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

  // ---- Slaytlar ---- (sayfada gömülü değil; yalnız araçlardaki "Slaytlar" ile tam ekran açılır)
  const [slideDeck, setSlideDeck] = useState<SlideDeck | null>(null);
  const [slidesExpanded, setSlidesExpanded] = useState(false);
  const [slidesReloadKey, setSlidesReloadKey] = useState(0);
  const [narrationOpen, setNarrationOpen] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const hasNarration = !!topic?.hasNarration;
  const topicId = topic?.id;
  useEffect(() => {
    if (topicId == null) return;
    let cancelled = false;
    fetch(`/api/topics/${topicId}/slides`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!cancelled) setSlideDeck(res.ok ? (data?.deck as SlideDeck) : null);
      })
      // Slayt yoksa/alınamazsa araç görünmez; ayrı bir hata ekranı yok.
      .catch(() => { if (!cancelled) setSlideDeck(null); });
    return () => { cancelled = true; };
  }, [topicId, slidesReloadKey]);

  // ---- Admin araçları ----
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [sectionMenuId, setSectionMenuId] = useState<string | number | null>(null);
  const [adminTool, setAdminTool] = useState<AdminToolRequest | null>(null);
  useEffect(() => { if (isAdmin) preloadAdminTopicTools(); }, [isAdmin]);
  const closeAdminTool = () => {
    setAdminTool(null);
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

  // ---- Okuma takibi ----
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
  const chipsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!activeSlug || !chipsRef.current) return;
    const chip = chipsRef.current.querySelector<HTMLElement>(`[data-chip="${CSS.escape(activeSlug)}"]`);
    if (chip) chipsRef.current.scrollTo({ left: chip.offsetLeft - 8, behavior: 'smooth' });
  }, [activeSlug]);

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

  const [showToTop, setShowToTop] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShowToTop(window.scrollY > window.innerHeight * 1.5);
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

  // ---- Paylaş: sistem paylaşımı varsa o, yoksa bağlantıyı kopyalar ----
  const [shareCopied, setShareCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: topic?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Kullanıcı paylaşımı iptal etti ya da pano izni yok — sessizce geç.
    }
  };

  const startTest = () => { void topicTest.startTest(false); };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!topic) return null;

  const steps: { id: StepId; title: string; meta: string; enabled: boolean }[] = [
    { id: 'kavramlar', title: 'Anahtar kavramlar', meta: highlights.length ? `${highlights.length} kavram` : 'Hazırlanıyor', enabled: highlights.length > 0 },
    { id: 'bolumler', title: 'Konu anlatımı', meta: sections.length ? `${sections.length} bölüm` : 'Oku', enabled: true },
    { id: 'ozet', title: 'Özet', meta: 'Kısa tekrar', enabled: !!(topic.summaryHtml || topic.discussionPromptHtml) },
  ];
  const activeStepIdx = steps.findIndex((x) => x.id === activeStep);
  const goStep = (id: StepId) => scrollTo(id);

  // Tüm araçlar tek listede: masaüstünde Çalışma Paneli'nde, mobilde hero altındaki şeritte.
  const tools: Tool[] = [
    hasNarration && { key: 'listen', label: 'Sesli anlatım', hint: 'Video / ses', icon: <Headphones size={18} aria-hidden="true" />, onClick: () => setNarrationOpen(true) },
    slideDeck && { key: 'slides', label: 'Slaytlar', hint: `${slideDeck.slides.length} slayt`, icon: <Presentation size={18} aria-hidden="true" />, onClick: () => setSlidesExpanded(true) },
    hasTest && { key: 'test', label: 'Kavrama testi', hint: testSize ? `${testSize} soru` : 'Test', icon: <ListChecks size={18} aria-hidden="true" />, onClick: startTest, disabled: topicTest.loading },
    unit && { key: 'discuss', label: 'Yorumlar', hint: 'Sor, tartış', icon: <MessageCircle size={18} aria-hidden="true" />, onClick: () => scrollTo('konu-tartisma') },
    unitQuestionsHref && { key: 'bank', label: 'Ünite soruları', hint: `${unit?.test_question_count ?? 0} soru`, icon: <Library size={18} aria-hidden="true" />, href: unitQuestionsHref },
    { key: 'pdf', label: 'PDF indir', hint: 'Yazdır, sakla', icon: <Download size={18} aria-hidden="true" />, href: `/api/topic-pdf/${topic.id}`, external: true },
    { key: 'share', label: shareCopied ? 'Kopyalandı' : 'Paylaş', hint: 'Bağlantı', icon: <Share2 size={18} aria-hidden="true" />, onClick: () => void share() },
  ].filter(Boolean) as Tool[];

  const renderTool = (t: Tool) => {
    const body = (
      <>
        <span className={s.toolIcon}>{t.icon}</span>
        <span className={s.toolText}><b>{t.label}</b><small>{t.hint}</small></span>
      </>
    );
    if (t.href && t.external) return <a key={t.key} href={t.href} className={s.tool}>{body}</a>;
    if (t.href) return <Link key={t.key} href={t.href} className={s.tool}>{body}</Link>;
    return <button key={t.key} type="button" className={s.tool} onClick={t.onClick} disabled={t.disabled}>{body}</button>;
  };

  return (
    <div className={cx(s.root, displayFont.variable, bodyFont.variable, monoFont.variable)}>
      <div className={s.wrap}>
        {/* Üst çubuk: konum + konu değiştir + admin */}
        <div className={s.topbar}>
          <nav className={s.crumbs} aria-label="Konum">
            {gradeSlug && <Link href={`/${gradeSlug}`} className={s.crumbHide}>{gradeName}</Link>}
            <ChevronRight size={14} className={cx(s.crumbSep, s.crumbHide)} aria-hidden="true" />
            {gradeSlug && lessonSlug && <Link href={`/${gradeSlug}/${lessonSlug}`} className={s.crumbHide}>{lessonName}</Link>}
            <ChevronRight size={14} className={cx(s.crumbSep, s.crumbHide)} aria-hidden="true" />
            {gradeSlug && lessonSlug && unitSlug ? <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}>{unitName}</Link> : <span>{unitName}</span>}
          </nav>
          <button type="button" className={s.ghostBtn} onClick={() => setSwitcherOpen(true)}>
            <ListTree size={16} aria-hidden="true" /> Konu değiştir
          </button>
          {isAdmin && (
            <button type="button" className={s.ghostBtn} onClick={() => setInteractiveOpen(true)}>
              🎬 Etkileşimli video (önizleme)
            </button>
          )}
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

        {/* HERO */}
        <header className={s.hero}>
          <div className={topic.heroImageUrl ? s.heroGrid : s.heroGridSolo}>
            <div className={s.heroMain}>
              <div className={s.heroTags}>
                <span className={s.pulseTag}><i className={s.pulse} aria-hidden="true" />{lessonName}</span>
                <span className={s.heroTag}>{gradeName}</span>
                <span className={s.heroTag}>Konu anlatımı</span>
              </div>
              <p className={s.kicker}>
                {unitIndex >= 0 && <b>Ünite {String(unitIndex + 1).padStart(2, '0')}</b>}
                <span>{unitName}</span>
                {contents.length > 1 && <span className={s.kickerCount}>Konu {topicIndex + 1}/{contents.length}</span>}
              </p>
              <h1 className={s.h1}>{topic.title}</h1>
              {topic.subtitle && <p className={s.lead}>{topic.subtitle}</p>}
              {topic.isArchived && <p className={s.archived}>Bu konu güncel müfredatta yer almıyor; içerik arşiv olarak duruyor.</p>}
              {/* Sesli anlatım / test / diğer araçlar hemen alttaki araç çubuğunda — burada tekrar edilmiyor. */}
              <div className={s.heroActions}>
                <button type="button" className={s.btnPrimary} onClick={() => scrollTo(highlights.length ? 'kavramlar' : 'bolumler')}>
                  Konuya başla <span className={s.arr} aria-hidden="true">→</span>
                </button>
              </div>
            </div>

            {topic.heroImageUrl && (
              <div className={s.heroSide}>
                <figure className={s.art}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={topic.heroImageUrl}
                    alt={buildTopicImageAlt(topic.title, lessonName, gradeName, topic.heroImageAlt)}
                    className={s.artImg}
                    onClick={() => setHeroZoomed(true)}
                  />
                </figure>
              </div>
            )}
          </div>
        </header>

        {/* Araç çubuğu: tüm araçlar hero'nun hemen altında, her ekranda ilk bakışta görünür. */}
        <div className={s.toolbar} role="toolbar" aria-label="Konu araçları">{tools.map(renderTool)}</div>

        {/* Mobil: öğrenme yolu yatay şeritte (masaüstünde Çalışma Paneli'nde) */}
        <div className={s.mobileSteps}>
          <ol className={s.stepStrip} aria-label="Öğrenme yolu">
            {steps.map((step, i) => {
              const now = step.id === activeStep;
              const done = !now && i < activeStepIdx && step.enabled;
              return (
                <li key={step.id}>
                  <button type="button" className={cx(s.stepPill, now && s.stepPillNow, done && s.stepPillDone)} disabled={!step.enabled} onClick={() => goStep(step.id)} aria-current={now ? 'step' : undefined}>
                    <span className={s.stepNo}>{done ? '✓' : i + 1}</span>{step.title}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={s.layout}>
          {/* ÇALIŞMA PANELİ (masaüstü, sabit) */}
          <aside className={s.panel} aria-label="Çalışma paneli">
            <div className={s.panelCard}>
              <div className={s.progress}>
                <span className={s.ring} style={{ background: `conic-gradient(var(--accent-2) 0 ${readPct}%, var(--line) 0 100%)` }} aria-hidden="true">
                  <span>{readPct}%</span>
                </span>
                <div>
                  <b>{readCount} / {sections.length || 0} bölüm</b>
                  <small>okundu</small>
                </div>
              </div>

              <p className={s.panelLabel}>Öğrenme yolu</p>
              <ol className={s.steps}>
                {steps.map((step, i) => {
                  const now = step.id === activeStep;
                  const done = !now && i < activeStepIdx && step.enabled;
                  return (
                    <li key={step.id}>
                      <button type="button" className={cx(s.step, now && s.stepNow, done && s.stepDone)} disabled={!step.enabled} onClick={() => goStep(step.id)} aria-current={now ? 'step' : undefined}>
                        <span className={s.stepNode}>{done ? '✓' : i + 1}</span>
                        <span className={s.stepText}><b>{step.title}</b><small>{now ? 'Buradasın' : step.meta}</small></span>
                      </button>
                    </li>
                  );
                })}
              </ol>

              {sections.length > 0 && (
                <>
                  <p className={s.panelLabel}>Bölümler</p>
                  <ol className={s.toc}>
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
                </>
              )}
            </div>
          </aside>

          <main className={s.main}>
            {topicOutcomes.length > 0 && (
              <OutcomeWeekCard
                key={topic.id}
                outcomes={topicOutcomes}
                currentWeek={week}
                totalWeeks={initialData.totalWeeks}
                termStartDate={initialData.termStartDate ?? null}
                breaks={initialData.breaks ?? []}
              />
            )}

            {/* Kavramlar */}
            {highlights.length > 0 && (
              <section className={s.block} id="kavramlar" data-step="kavramlar">
                <div className={s.blockHead}>
                  <p className={s.label}>Adım 1 · {highlights.length} kavram</p>
                  <h2 className={s.h2}>Önce kavramları tanı</h2>
                  <p className={s.blockText}>Konu boyunca bu kavramlar sık geçecek. Metinde kalın yazılan terimler işaretli.</p>
                </div>
                <dl className={s.glossary}>
                  {highlights.map((h, i) => (
                    <div key={`${h.title}-${i}`} className={s.term}>
                      <span className={s.termNo}>{String(i + 1).padStart(2, '0')}</span>
                      <dt>{h.icon && <span aria-hidden="true">{h.icon} </span>}{h.title}</dt>
                      <dd>{h.description}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Konu anlatımı */}
            <section className={s.block} id="bolumler" data-step="bolumler">
              <div className={s.blockHead}>
                <p className={s.label}>Adım 2 · {sections.length ? `${sections.length} bölüm` : 'Konu anlatımı'}</p>
                <h2 className={s.h2}>Konuyu adım adım öğren</h2>
              </div>

              {sections.length > 0 && (
                <nav className={s.chips} aria-label="Bölümler" ref={chipsRef}>
                  {sections.map((sec) => {
                    const slug = sectionSlugs.get(sec.id) || String(sec.id);
                    return (
                      <a key={sec.id} href={`#${slug}`} data-chip={slug} title={sec.heading} className={slug === activeSlug ? s.chipActive : s.chip}>
                        {sec.heading}
                      </a>
                    );
                  })}
                </nav>
              )}

              {sections.length > 0 ? (
                sections.map((sec, i) => {
                  const slug = sectionSlugs.get(sec.id) || String(sec.id);
                  const hasBody = !!(sec.html || sec.imageUrl || sec.diagramSvg || sec.videoUrl);
                  return (
                    <article key={sec.id} id={slug} data-part data-section-anchor={slug} className={cx(s.part, slug === activeSlug && s.partActive)}>
                      <div className={s.partHead}>
                        <span className={s.partNo} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                        <div className={s.partTitleWrap}>
                          <p className={s.partKicker}>Bölüm {i + 1} / {sections.length}</p>
                          <h3 className={s.partTitle}>{sec.heading}</h3>
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
                    </article>
                  );
                })
              ) : topic.content ? (
                <article className={s.part}><div className={s.prose}><SectionContent html={topic.content} /></div></article>
              ) : (
                <p className={s.pending}>Bu konunun anlatımı hazırlanıyor.</p>
              )}
              <div className={s.complete}><TopicCompleteButton topicId={topic.id} /></div>
            </section>

            {/* Özet + düşün ve yorumla */}
            {(topic.summaryHtml || topic.discussionPromptHtml) && (
              <section className={s.block} id="ozet" data-step="ozet">
                <div className={s.blockHead}>
                  <p className={s.label}>Adım 3 · Kısa tekrar</p>
                  <h2 className={s.h2}>Özetle ve düşün</h2>
                </div>
                <div className={s.wrapup}>
                  {topic.summaryHtml && (
                    <div className={s.summary}>
                      <p className={s.label}>Özet</p>
                      <div className={s.prose} dangerouslySetInnerHTML={{ __html: topic.summaryHtml }} />
                    </div>
                  )}
                  {topic.discussionPromptHtml && (
                    <div className={s.think}>
                      <p className={s.labelLight}>Düşün ve yorumla</p>
                      <div className={s.thinkPrompt} dangerouslySetInnerHTML={{ __html: topic.discussionPromptHtml }} />
                      <button type="button" className={s.btnLight} onClick={() => scrollTo('konu-tartisma')}>
                        Cevabını yaz <span className={s.arr} aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Test */}
            {hasTest && (
              <section className={s.cta} id="test">
                <div className={s.bigNum}>{testSize ?? '…'}<small>soru</small></div>
                <div>
                  <p className={s.labelLight}>Kavrama testi</p>
                  <h2 className={s.ctaTitle}>Ne kadar anladın?</h2>
                  <p className={s.ctaText}>Kavrama testiyle kendini dene. Yarım bıraktığın test kaldığın yerden devam eder.</p>
                </div>
                <button type="button" className={s.btnLight} onClick={startTest} disabled={topicTest.loading}>
                  {topicTest.loading ? 'Açılıyor…' : topicTest.status?.resumable ? 'Teste devam et' : 'Testi başlat'} <span className={s.arr} aria-hidden="true">→</span>
                </button>
              </section>
            )}

            {/* Önceki · sonraki konu (ünite soruları araçlarda). */}
            {(prev || next) && (
              <nav className={s.pager} aria-label="Konular arası geçiş">
                {prev ? (
                  <Link href={prev.href} className={cx(s.pageLink, s.pagePrev)} rel="prev">
                    <span className={s.go} aria-hidden="true">←</span>
                    <span className={s.pageText}><small>{prev.label}</small><strong>{prev.title}</strong></span>
                  </Link>
                ) : <span aria-hidden="true" />}
                {next ? (
                  <Link href={next.href} className={cx(s.pageLink, s.pageNext)} rel="next">
                    <span className={s.pageText}><small>{next.label}</small><strong>{next.title}</strong></span>
                    <span className={s.go} aria-hidden="true">→</span>
                  </Link>
                ) : <span aria-hidden="true" />}
              </nav>
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
          </main>

          {/* SAĞ: Konu araçları kartı (geniş ekran, sabit). Dar ekranda aynı araçlar hero altındaki çubukta. */}
          <aside className={s.rail} aria-label="Konu araçları">
            <div className={s.railCard}>
              <div className={s.railHead}>
                <p className={s.railLabel}>Hızlı erişim</p>
                <h2 className={s.railTitle}>Konu araçları</h2>
                <p className={s.railSub}>Dinle, tekrar et, kendini dene.</p>
              </div>
              <div className={s.railTools}>{tools.map(renderTool)}</div>
            </div>
          </aside>
        </div>
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
      {interactiveOpen && isAdmin && createPortal(
        <InteractiveLessonPlayer topicId={Number(topic.id)} onClose={() => setInteractiveOpen(false)} />,
        document.body
      )}
      {narrationOpen && hasNarration && createPortal(
        <NarrationPlayer topicId={Number(topic.id)} onClose={() => setNarrationOpen(false)} />,
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
