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
import { Inter, JetBrains_Mono, Onest } from 'next/font/google';
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
import RecapCardView from './RecapCardView';
import { TopicCompleteButton, useTopicTest, TopicTestConflictModal, TopicTestErrorModal } from '../DersClientCards';
import { buildSectionSlugs, buildSectionImageAlt, buildTopicHref, buildTopicImageAlt, type Content, type GradeLesson, type GradeOption, type Outcome, type TopicSection, type Unit } from '../dersHelpers';
import { formatWeekDateRangeLabel, type CurriculumBreak } from '@/app/src/lib/routeParsing';
import AdminTopicToolsHost, { preloadAdminTopicTools, ADMIN_TOOLS_MENU, SECTION_ADMIN_TOOLS_MENU, type AdminToolRequest } from '../AdminTopicToolsHost';
import SlidePlayer from '@/app/src/components/SlidePlayer';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import { useAuth } from '@/app/src/context/AuthContext';
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
const GuestTopicTest = dynamic(() => import('@/app/src/components/questionPlayer/GuestTopicTest'), { ssr: false });

// Başlık yazı tipi Onest (2026-10-23): Space Grotesk'te uzun Türkçe başlıklar zor okunuyordu.
const displayFont = Onest({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800'], variable: '--font-v1-display', display: 'swap' });
const bodyFont = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-v1-body', display: 'swap' });
const monoFont = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--font-v1-mono', display: 'swap' });

const NO_SECTIONS: NonNullable<Content['sections']> = [];

// Sayfanın okuma blokları — içindekilerde hangisinde olunduğunu vurgulamak için.
type StepId = 'kavramlar' | 'bolumler' | 'ozet';

type OutcomeGroup = {
  key: string;
  learningOutcome: NonNullable<Outcome['learningOutcome']> | null;
  items: { key: string; letter: string; description: string; weekRanges: NonNullable<Outcome['weekRanges']> }[];
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
    group.items.push({ key: String(o.id ?? `${key}-${group.items.length}`), letter, description: o.description, weekRanges: o.weekRanges ?? [] });
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

// Hero'daki kazanımlar (2026-10-23, ayrı karttan taşındı): her kazanım yalnızca işleneceği hafta(lar)da
// görünür; ilk HERO_OUTCOME_LIMIT tanesi açık, gerisi "+N kazanım daha" ile — hero uzayıp "Konuya başla"yı itmesin.
// Tek kazanım için kısaltma yapılmaz ("+1 kazanım daha" tıklatmaya değmez).
// Telefonda (≤640px) ilk HERO_OUTCOME_LIMIT_MOBILE tanesi, "+1" de olur (2026-10-25: bir kazanım ~90px, düğme ~30px).
// Kısaltma CSS ile (data-hide-d / data-hide-m): sunucu HTML'i ekran genişliğinden bağımsız, hydration uyuşmazlığı yok.
// TÜM haftaların kazanımları HTML'de, görünmeyenler `hidden` (2026-10-24): kazanım metinleri arama trafiği
// getiriyor (ör. "…gerçek yaşam problemlerini çözebilme" aramasında MAT.7.1.4), sayfadan düşmesinler.
const HERO_OUTCOME_LIMIT = 3;
const HERO_OUTCOME_LIMIT_MOBILE = 2;

function HeroOutcomes({ outcomes, currentWeek, totalWeeks, termStartDate, breaks }: {
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

  const groups = useMemo(() => groupOutcomes(outcomes), [outcomes]);
  const [expanded, setExpanded] = useState(false);
  const inWeek = groups.flatMap((g) => g.items).filter((o) => week == null || o.weekRanges.some((r) => week >= r.start && week <= r.end));
  const total = inWeek.length;
  const collapsible = total > HERO_OUTCOME_LIMIT + 1;
  const collapsibleMobile = total > HERO_OUTCOME_LIMIT_MOBILE;
  const keysOf = (list: typeof inWeek) => new Set(list.map((o) => o.key));
  const inWeekKeys = keysOf(inWeek);
  const shownD = keysOf(expanded || !collapsible ? inWeek : inWeek.slice(0, HERO_OUTCOME_LIMIT));
  const shownM = keysOf(expanded || !collapsibleMobile ? inWeek : inWeek.slice(0, HERO_OUTCOME_LIMIT_MOBILE));
  // Haftada olmayan: hidden. Haftada olup kısaltılan: yalnız o ekran boyunda CSS ile gizli.
  const hideProps = (keys: string[]) => ({
    hidden: !keys.some((k) => inWeekKeys.has(k)),
    'data-hide-d': keys.some((k) => shownD.has(k)) ? undefined : '',
    'data-hide-m': keys.some((k) => shownM.has(k)) ? undefined : '',
  });

  return (
    <section className={s.heroOutcomes} aria-labelledby="kazanimlar-baslik">
      <div className={s.hoHead}>
        <h2 id="kazanimlar-baslik" className={s.hoTitle}>Kazanımlar</h2>
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
          <div key={g.key} className={s.outcomeGroup} {...hideProps(g.items.map((o) => o.key))}>
            {g.learningOutcome && (
              <p className={s.learningOutcome}>
                {g.learningOutcome.code && <><span className={s.code}>{g.learningOutcome.code}</span>{' '}</>}
                {g.learningOutcome.title}
              </p>
            )}
            <ol className={s.outcomeList}>
              {g.items.map((o) => (
                <li key={o.key} className={s.outcome} {...hideProps([o.key])}>
                  <span className={s.outcomeTag}>{o.letter}</span>{' '}
                  <span>{o.description}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {collapsibleMobile && (
        <button type="button" className={cx(s.hoMore, collapsible ? undefined : s.hoMoreMobileOnly)} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? (
            'Daha az göster'
          ) : (
            <>
              <span className={s.hoMoreD}>+{total - HERO_OUTCOME_LIMIT} kazanım daha</span>
              <span className={s.hoMoreM}>+{total - HERO_OUTCOME_LIMIT_MOBILE} kazanım daha</span>
            </>
          )}
        </button>
      )}
    </section>
  );
}

// Süs numaraları (01, 02…) metinde değil, CSS'te (.num::before → data-no): arama motoru başlığı "01Millî Kültür" diye
// yapışık okumasın, içindekiler bağlantı metni temiz kalsın (2026-10-25).
function pad2(i: number) {
  return String(i + 1).padStart(2, '0');
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
  const { user } = useAuth();
  const [pdfGateOpen, setPdfGateOpen] = useState(false);
  const { gradeName, lessonName, unitName, gradeSlug, lessonSlug, unitSlug, contents, gradeLessons = [], allGrades = [] } = initialData;

  const topicIndex = Math.max(0, contents.findIndex((c) => c.slug === initialData.topicSlug));
  const topic: Content | undefined = contents[topicIndex];
  const units = useMemo(() => [...(initialData.units || [])].sort((a, b) => a.order_no - b.order_no), [initialData.units]);
  const unitIndex = units.findIndex((u) => u.slug === unitSlug);
  const unit: Unit | undefined = units[unitIndex];

  const sections = topic?.sections ?? NO_SECTIONS;
  const sectionSlugs = useMemo(() => buildSectionSlugs(sections), [sections]);
  // Hap bilgi düzeni yalnız anlatımı olan her bölümün kartı varken (kart üretimi konu bazında hep-ya-da-hiç).
  const recapMode = sections.some((sec) => sec.recapCard) && sections.every((sec) => sec.recapCard || !sec.html);
  // Kartlı konuda "Anahtar kavramlar" yok (2026-10-24, kullanıcı): aynı kavramlar kartlarda kalın ve Özet'te tanımlı —
  // tekrar sayfayı uzatıyor, telefonda hap bilgileri aşağı itiyordu.
  const highlights = recapMode ? [] : topic?.highlights ?? [];
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
  // Misafir testi soru bankasındakiyle aynı (sıradaki 10 soru, bkz. GuestTopicTest).
  const [guestTestOpen, setGuestTestOpen] = useState(false);

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
  const [activeStep, setActiveStep] = useState<StepId>('kavramlar');
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const partObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const slug = (e.target as HTMLElement).id;
        setActiveSlug(slug);
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

  const startTest = () => {
    if (topicTest.status && !topicTest.status.loggedIn) setGuestTestOpen(true);
    else void topicTest.startTest(false);
  };
  // Slayttan teste geçince slaytlar kapanır: iki tam ekran oynatıcının klavye kısayolları (Escape, oklar) çakışmasın.
  const startTestFromSlides = () => {
    setSlidesExpanded(false);
    startTest();
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const renderSectionAdmin = (sec: TopicSection) =>
    isAdmin && (
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
    );

  if (!topic) return null;

  const hasSummary = !!(topic.summaryHtml || topic.discussionPromptHtml);

  // Tüm araçlar tek listede: masaüstünde Çalışma Paneli'nde, mobilde hero altındaki şeritte.
  const tools: Tool[] = [
    hasNarration && { key: 'listen', label: 'Sesli anlatım', hint: 'Video / ses', icon: <Headphones size={18} aria-hidden="true" />, onClick: () => setNarrationOpen(true) },
    slideDeck && { key: 'slides', label: 'Slaytlar', hint: `${slideDeck.slides.length} slayt`, icon: <Presentation size={18} aria-hidden="true" />, onClick: () => setSlidesExpanded(true) },
    hasTest && { key: 'test', label: 'Kavrama testi', hint: testSize ? `${testSize} soru` : 'Test', icon: <ListChecks size={18} aria-hidden="true" />, onClick: startTest, disabled: topicTest.loading },
    unit && { key: 'discuss', label: 'Yorumlar', hint: 'Sor, tartış', icon: <MessageCircle size={18} aria-hidden="true" />, onClick: () => scrollTo('konu-tartisma') },
    unitQuestionsHref && { key: 'bank', label: 'Ünite soruları', hint: `${unit?.test_question_count ?? 0} soru`, icon: <Library size={18} aria-hidden="true" />, href: unitQuestionsHref },
    { key: 'pdf', label: 'PDF indir', hint: 'Yazdır, sakla', icon: <Download size={18} aria-hidden="true" />, href: user ? `/api/topic-pdf/${topic.id}` : undefined, external: true, onClick: user ? undefined : () => setPdfGateOpen(true) },
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
          <div className={s.heroInner}>
            {/* Başlık tam genişlikte (2026-10-23): yarım sütunda 4 satıra bölünüyordu. */}
            <div className={s.heroTags}>
              <span className={s.pulseTag}><i className={s.pulse} aria-hidden="true" />{lessonName}</span>{' '}
              <span className={s.heroTag}>{gradeName}</span>{' '}
              <span className={s.heroTag}>Konu anlatımı</span>
            </div>
            <p className={s.kicker}>
              {unitIndex >= 0 && <><b>Ünite {pad2(unitIndex)}</b>{' '}</>}
              <span>{unitName}</span>
              {contents.length > 1 && <>{' '}<span className={s.kickerCount}>Konu {topicIndex + 1}/{contents.length}</span></>}
            </p>
            <h1 className={s.h1}>{topic.title}</h1>
            <div className={topic.heroImageUrl ? s.heroGrid : s.heroGridSolo}>
              <div className={s.heroMain}>
                {topic.subtitle && <p className={s.lead}>{topic.subtitle}</p>}
                {topic.isArchived && <p className={s.archived}>Bu konu güncel müfredatta yer almıyor; içerik arşiv olarak duruyor.</p>}
                {topicOutcomes.length > 0 && (
                  <HeroOutcomes
                    key={topic.id}
                    outcomes={topicOutcomes}
                    currentWeek={week}
                    totalWeeks={initialData.totalWeeks}
                    termStartDate={initialData.termStartDate ?? null}
                    breaks={initialData.breaks ?? []}
                  />
                )}
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
          </div>
        </header>

        {/* Araç çubuğu: tüm araçlar hero'nun hemen altında, her ekranda ilk bakışta görünür. */}
        {/* Mobil/tablet araç paneli — sitenin robotik kontrol paneli dili (2026-10-25). Geniş ekranda sağdaki kart. */}
        <div className={s.toolDock}>
          <p className={s.toolDockHead}>
            <i className={s.dockLed} aria-hidden="true" />
            Konu araçları
            <span>{tools.length} araç</span>
          </p>
          <div className={s.toolbar} role="toolbar" aria-label="Konu araçları">{tools.map(renderTool)}</div>
        </div>

        <div className={s.layout}>
          {/* ÇALIŞMA PANELİ (masaüstü, sabit) */}
          <aside className={s.panel} aria-label="Çalışma paneli">
            <div className={s.panelCard}>
              {/* Mini içindekiler (2026-10-23): öğrenme yolu, okundu halkası ve ✓ işaretleri kaldırıldı. */}
              <p className={s.panelLabel}>İçindekiler</p>
              <ol className={s.toc}>
                {highlights.length > 0 && (
                  <li>
                    <a href="#kavramlar" className={cx(s.tocLink, activeStep === 'kavramlar' && s.tocActive)} aria-current={activeStep === 'kavramlar' ? 'location' : undefined}>
                      <span className={s.tocNo} aria-hidden="true" />
                      <span>Anahtar kavramlar</span>
                    </a>
                  </li>
                )}
                {sections.map((sec, i) => {
                  const slug = sectionSlugs.get(sec.id) || String(sec.id);
                  const active = activeStep === 'bolumler' && slug === activeSlug;
                  return (
                    <li key={sec.id}>
                      <a href={`#${slug}`} className={cx(s.tocLink, active && s.tocActive)} aria-current={active ? 'location' : undefined}>
                        <span className={cx(s.tocNo, s.num)} data-no={pad2(i)} aria-hidden="true" />
                        <span>{sec.heading}</span>
                      </a>
                    </li>
                  );
                })}
                {hasSummary && (
                  <li>
                    <a href="#ozet" className={cx(s.tocLink, activeStep === 'ozet' && s.tocActive)} aria-current={activeStep === 'ozet' ? 'location' : undefined}>
                      <span className={s.tocNo} aria-hidden="true" />
                      <span>Özet</span>
                    </a>
                  </li>
                )}
              </ol>
            </div>
          </aside>

          <main className={s.main}>
            {/* Kavramlar */}
            {highlights.length > 0 && (
              <section className={s.block} id="kavramlar" data-step="kavramlar">
                <div className={s.blockHead}>
                  <h2 className={s.h2}>Anahtar kavramlar</h2>
                </div>
                <dl className={s.glossary}>
                  {highlights.map((h, i) => (
                    <div key={`${h.title}-${i}`} className={s.term}>
                      <span className={cx(s.termNo, s.num)} data-no={pad2(i)} aria-hidden="true" />
                      <dt>{h.icon && <span aria-hidden="true">{h.icon} </span>}{h.title}</dt>
                      <dd>{h.description}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Konu anlatımı */}
            <section className={s.block} id="bolumler" data-step="bolumler">
              {/* Görünür etiket yok (2026-10-24, sade sayfa); başlık sırası h2 → bölüm h3 bozulmasın diye ekran okuyucuya açık. */}
              <h2 className={s.srOnly}>Konu bölümleri</h2>

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

              {recapMode ? (
                <>
                  {/* Kartlı konu (2026-10-24): bölümler ayrı kartlar değil, tek sayfada birbirinin devamı (PDF gibi).
                      Görsel geniş ekranda kartın yanında; uzun anlatım aşağıdaki kapalı "Detaylı konu anlatımı"nda. */}
                  <div className={s.sheet}>
                    {sections.map((sec, i) => {
                      const slug = sectionSlugs.get(sec.id) || String(sec.id);
                      const hasMedia = !!(sec.imageUrl || sec.diagramSvg || sec.videoUrl);
                      const media = (
                        <SectionContent
                          only="media"
                          html=""
                          sectionId={sec.id}
                          heading={sec.heading}
                          imageUrl={sec.imageUrl}
                          caption={sec.heading}
                          imageAlt={buildSectionImageAlt(sec.heading, topic.title, lessonName, gradeName, sec.imageAlt)}
                          diagramSvg={sec.diagramSvg}
                          videoUrl={sec.videoUrl}
                          videoType={sec.videoType}
                        />
                      );
                      return (
                        <article key={sec.id} id={slug} data-part data-section-anchor={slug} className={s.sheetPart}>
                          <div className={s.sheetHead}>
                            <span className={cx(s.sheetNo, s.num)} data-no={pad2(i)} aria-hidden="true" />
                            <h3 className={s.sheetTitle}>{sec.heading}</h3>
                            {renderSectionAdmin(sec)}
                          </div>
                          <div className={hasMedia ? s.sheetGrid : undefined}>
                            {sec.recapCard ? <RecapCardView card={sec.recapCard} /> : <p className={s.pending}>İçerik hazırlanıyor.</p>}
                            {hasMedia && <div>{media}</div>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <details id="detayli-anlatim" className={s.detail}>
                    <summary>
                      Detaylı konu anlatımı <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <div className={s.detailBody}>
                      {sections.map((sec, i) => {
                        if (!sec.html) return null;
                        const slug = sectionSlugs.get(sec.id) || String(sec.id);
                        return (
                          <section key={sec.id} id={`${slug}-detay`} className={s.detailPart}>
                            <h3 className={s.detailTitle}><span className={s.num} data-no={pad2(i)} aria-hidden="true" />{sec.heading}</h3>
                            <div className={s.prose}>
                              <SectionContent only="prose" html={sec.html} sectionId={sec.id} heading={sec.heading} />
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </details>
                  {/* Etkinlikler ayrı blokta (2026-10-24, kullanıcı): özet sade kalsın, metin sayfada kalsın (SEO). */}
                  {sections.some((sec) => sec.activityPromptHtml) && (
                    <section className={s.practice} aria-labelledby="alistirmalar-baslik">
                      <h2 id="alistirmalar-baslik" className={s.practiceTitle}>Konuyu anlama alıştırmaları</h2>
                      {sections.map((sec, i) =>
                        sec.activityPromptHtml ? (
                          <div key={sec.id} className={s.practiceItem}>
                            <p className={s.practiceHead}><span className={s.num} data-no={pad2(i)} aria-hidden="true" />{sec.heading}</p>
                            <SectionContent
                              only="activity"
                              html=""
                              activityPromptHtml={sec.activityPromptHtml}
                              activityExampleHtml={sec.activityExampleHtml}
                              sectionId={sec.id}
                              heading={sec.heading}
                            />
                          </div>
                        ) : null
                      )}
                    </section>
                  )}
                </>
              ) : sections.length > 0 ? (
                sections.map((sec, i) => {
                  const slug = sectionSlugs.get(sec.id) || String(sec.id);
                  const hasBody = !!(sec.html || sec.imageUrl || sec.diagramSvg || sec.videoUrl);
                  const body = hasBody ? (
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
                  ) : null;
                  return (
                    <article key={sec.id} id={slug} data-part data-section-anchor={slug} className={cx(s.part, slug === activeSlug && s.partActive)}>
                      <div className={s.partHead}>
                        <span className={cx(s.partNo, s.num)} data-no={pad2(i)} aria-hidden="true" />
                        <div className={s.partTitleWrap}>
                          <h3 className={s.partTitle}>{sec.heading}</h3>
                        </div>
                        {renderSectionAdmin(sec)}
                      </div>
                      {body ?? <p className={s.pending}>İçerik hazırlanıyor.</p>}
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
                  <h2 className={s.h2}>{topic.summaryHtml ? 'Özet' : 'Düşün ve yorumla'}</h2>
                </div>
                <div className={s.wrapup}>
                  {topic.summaryHtml && (
                    <div className={s.summary}>
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
          onStartTest={hasTest ? startTestFromSlides : undefined}
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
      {guestTestOpen && unit && createPortal(
        <GuestTopicTest
          gradeId={Number(gradeId)}
          lessonId={Number(lessonId)}
          unitId={Number(unit.id)}
          topicId={Number(topic.id)}
          scopeLabel={`${gradeName} · ${lessonName} · ${topic.title}`}
          onClose={() => setGuestTestOpen(false)}
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
      {pdfGateOpen && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={() => setPdfGateOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="pdf-gate-title" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700"><Download size={22} aria-hidden="true" /></div>
            <h2 id="pdf-gate-title" className="text-base font-extrabold text-slate-900">PDF indirmek için üye olun</h2>
            <p className="mt-2 text-sm text-slate-600">Konu PDF&apos;leri yalnızca üyelerimize özel. Ücretsiz üye olup hemen indirebilir, ilerlemenizi de kaydedebilirsiniz.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link href={`/register?redirectTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`} className="rounded-lg bg-sky-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-sky-700">Ücretsiz üye ol</Link>
              <Link href={`/login?redirectTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`} className="rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Zaten üyeyim, giriş yap</Link>
              <button type="button" onClick={() => setPdfGateOpen(false)} className="rounded-lg bg-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200">Vazgeç</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {topicTest.error && createPortal(<TopicTestErrorModal message={topicTest.error} onClose={topicTest.closeTest} />, document.body)}
      {isAdmin && adminTool && <AdminTopicToolsHost topicId={Number(topic.id)} request={adminTool} onClose={closeAdminTool} />}
    </div>
  );
}
