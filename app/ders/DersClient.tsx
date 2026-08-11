'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/src/context/AuthContext';
import {
  ChevronRight,
  BookOpen,
  Trophy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Menu,
  X,
  Clipboard,
  Settings,
  MoreVertical,
  Volume2,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Sparkles,
  Layers,
  Compass,
  Puzzle,
  Rocket,
  PenTool,
  Globe2,
  Atom,
  Brain,
  Star,
} from 'lucide-react';
import AdminTopicSectionsModal from '@/app/src/components/admin/AdminTopicSectionsModal';
import { PlanModal, SectionModal, type SectionModalSection } from '@/app/src/components/admin/AdminTopicSectionsPanel';

type Outcome = { id?: string | number; description: string; topicId?: string | number | null };
type TopicSection = { id: string | number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null };
type TopicHighlight = { position: string; icon: string | null; title: string; description: string };
type Content = {
  id: string | number;
  title: string;
  content?: string | null;
  sections?: TopicSection[];
  heroImageUrl?: string | null;
  subtitle?: string | null;
  highlights?: TopicHighlight[];
};
type Unit = { id: number; title: string; slug: string | null; order_no: number; start_week: number | null; end_week: number | null };
type ProfileRoleRow = { role: string | null };

interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: Outcome[];
    contents: Content[];
    units?: Unit[];
    totalWeeks: number;
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

const TOPIC_STYLES = [
  { Icon: BookOpen, bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { Icon: Atom, bg: 'bg-purple-100', text: 'text-purple-600' },
  { Icon: Compass, bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { Icon: Puzzle, bg: 'bg-amber-100', text: 'text-amber-600' },
  { Icon: Rocket, bg: 'bg-rose-100', text: 'text-rose-600' },
  { Icon: Layers, bg: 'bg-cyan-100', text: 'text-cyan-600' },
  { Icon: PenTool, bg: 'bg-fuchsia-100', text: 'text-fuchsia-600' },
  { Icon: Globe2, bg: 'bg-lime-100', text: 'text-lime-700' },
  { Icon: Brain, bg: 'bg-orange-100', text: 'text-orange-600' },
  { Icon: Star, bg: 'bg-sky-100', text: 'text-sky-600' },
];

function getTopicStyle(index: number) {
  return TOPIC_STYLES[index % TOPIC_STYLES.length];
}

const STUDY_TIPS = [
  'Bir konuyu okuduktan sonra kendi cümlelerinle özetlemek, kalıcılığı artırır.',
  'Kısa aralıklarla tekrar etmek, tek seferde uzun çalışmaktan daha etkilidir.',
  'Öğrendiğin bir konuyu birine anlatmayı dene, eksiklerin hemen ortaya çıkar.',
  'Not alarak okumak, sadece okumaktan daha kalıcı öğrenme sağlar.',
  'Zor gelen kısımları atlamak yerine üzerinde durup anlamaya çalış.',
];

function HighlightCard({ highlight }: { highlight: TopicHighlight }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-3.5 flex items-start gap-2.5">
      {highlight.icon && <span className="text-xl leading-none shrink-0">{highlight.icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-800 leading-snug">{highlight.title}</p>
        <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">{highlight.description}</p>
      </div>
    </div>
  );
}

export default function DersClient({ initialData, gradeId, lessonId, week }: DersClientProps) {
  const { user, supabase } = useAuth();

  const { gradeName, lessonName, unitName, gradeSlug, lessonSlug } = initialData;

  const [units, setUnits] = useState<Unit[]>(initialData.units || []);
  const [outcomes, setOutcomes] = useState<Outcome[]>(initialData.outcomes);
  const [contents, setContents] = useState<Content[]>(initialData.contents);
  const [isWeekDataLoading, setIsWeekDataLoading] = useState(true);
  const [activeTopicId, setActiveTopicId] = useState<string | number | null>(initialData.contents[0]?.id || null);
  const [activeSectionId, setActiveSectionId] = useState<string | number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [outcomesOpen, setOutcomesOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topicMenuOpenId, setTopicMenuOpenId] = useState<string | number | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  const [managingTopicId, setManagingTopicId] = useState<number | null>(null);
  const [planModalTopicId, setPlanModalTopicId] = useState<number | null>(null);
  const [sectionModalTarget, setSectionModalTarget] = useState<{ topicId: number; section: SectionModalSection } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedTopicIndex = useMemo(() => {
    const idx = contents.findIndex((c) => String(c.id) === String(activeTopicId));
    return idx >= 0 ? idx : 0;
  }, [contents, activeTopicId]);

  const selectedTopicId = contents[selectedTopicIndex]?.id ?? null;
  const activeTopic = contents[selectedTopicIndex];

  const currentSection = useMemo(() => {
    const sections = activeTopic?.sections;
    if (!sections || !sections.length || activeSectionId == null) return null;
    return sections.find((s) => String(s.id) === String(activeSectionId)) || null;
  }, [activeTopic, activeSectionId]);

  const currentSectionIndex = useMemo(() => {
    if (!activeTopic?.sections || !currentSection) return -1;
    return activeTopic.sections.findIndex((s) => String(s.id) === String(currentSection.id));
  }, [activeTopic, currentSection]);

  const activeTopicOutcomes = useMemo(() => {
    if (!selectedTopicId) return outcomes;
    const matchingOutcomes = outcomes.filter((outcome) => String(outcome.topicId ?? '') === String(selectedTopicId));
    return matchingOutcomes.length ? matchingOutcomes : outcomes.filter((outcome) => outcome.topicId == null);
  }, [outcomes, selectedTopicId]);

  const studyTip = STUDY_TIPS[selectedTopicIndex % STUDY_TIPS.length];

  useEffect(() => {
    if (selectedTopicId == null) return;
    setExpandedTopicIds((prev) => {
      const key = String(selectedTopicId);
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selectedTopicId]);

  const toggleTopicExpanded = (id: string | number) => {
    setExpandedTopicIds((prev) => {
      const key = String(id);
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Müfredat özeti (üniteler + haftalar) sayfasına dönüş linki
  const overviewHref = useMemo(() => {
    if (gradeSlug && lessonSlug) {
      return `/${gradeSlug}/${lessonSlug}`;
    }
    return `/ders?sinif=${gradeId}&ders=${lessonId}`;
  }, [gradeSlug, lessonSlug, gradeId, lessonId]);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminRole() {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsAdmin((data as ProfileRoleRow | null)?.role === 'admin');
      }
    }

    loadAdminRole();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const activeUnit = units.find(u => week >= (u.start_week || 1) && week <= (u.end_week || 38)) || units[0];
  const unitTitle = activeUnit?.title || unitName || 'Ünite Bulunamadı';

  const totalTopics = contents.length;
  const progressPercent = totalTopics ? Math.round(((selectedTopicIndex + 1) / totalTopics) * 100) : 0;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedTopicId]);

  useEffect(() => {
    setUnits(initialData.units || []);
    setContents(initialData.contents);
    setOutcomes(initialData.outcomes);
    setActiveTopicId(initialData.contents[0]?.id || null);
    setOutcomesOpen(false);
    setIsWeekDataLoading(true);
  }, [initialData]);

  const loadWeekData = useCallback(async (unitId: number, signal?: AbortSignal) => {
    setIsWeekDataLoading(true);
    const params = new URLSearchParams({
      gradeId,
      lessonId,
      unitId: String(unitId),
      week: String(week),
    });
    try {
      const response = await fetch(`/api/lesson-week-data?${params.toString()}`, { signal });
      if (!response.ok) return;

      const data = await response.json() as { outcomes?: Outcome[]; contents?: Content[] };
      if (signal?.aborted) return;

      setOutcomes(data.outcomes || []);
      if (data.contents?.length) {
        setContents(data.contents);
        setActiveTopicId((current) => (
          data.contents?.some((topic) => String(topic.id) === String(current))
            ? current
            : data.contents?.[0]?.id || null
        ));
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Hafta verisi yüklenemedi:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setIsWeekDataLoading(false);
      }
    }
  }, [gradeId, lessonId, week]);

  useEffect(() => {
    if (!activeUnit?.id) {
      setIsWeekDataLoading(false);
      return;
    }

    const controller = new AbortController();
    loadWeekData(activeUnit.id, controller.signal);
    return () => controller.abort();
  }, [activeUnit?.id, loadWeekData]);

  const refreshWeekData = useCallback(() => {
    if (activeUnit?.id) loadWeekData(activeUnit.id);
  }, [activeUnit, loadWeekData]);

  const goToTopic = (index: number) => {
    const topic = contents[index];
    if (!topic) return;
    setActiveTopicId(topic.id);
    setActiveSectionId(null);
  };

  const goToSection = (index: number, sectionId: string | number) => {
    const topic = contents[index];
    if (!topic) return;
    if (String(activeTopicId) !== String(topic.id)) setActiveTopicId(topic.id);
    setActiveSectionId(sectionId);
    setSidebarOpen(false);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sections = activeTopic?.sections || [];

  const goForward = () => {
    if (sections.length) {
      if (currentSection) {
        if (currentSectionIndex < sections.length - 1) {
          setActiveSectionId(sections[currentSectionIndex + 1].id);
          contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        goToTopic(selectedTopicIndex + 1);
        return;
      }
      setActiveSectionId(sections[0].id);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    goToTopic(selectedTopicIndex + 1);
  };

  const goBackward = () => {
    if (sections.length && currentSection) {
      if (currentSectionIndex > 0) {
        setActiveSectionId(sections[currentSectionIndex - 1].id);
      } else {
        setActiveSectionId(null);
      }
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    goToTopic(selectedTopicIndex - 1);
  };

  const isAtVeryStart = selectedTopicIndex <= 0 && !currentSection;
  const isAtVeryEnd = selectedTopicIndex >= totalTopics - 1
    && (!sections.length || (!!currentSection && currentSectionIndex >= sections.length - 1));

  return (
    <div className="flex h-[calc(100dvh-60px)] sm:h-[calc(100dvh-72px)] flex-col bg-[#f9fafb] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

      {/* TOP APP BAR */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-6 h-16 flex items-center gap-3 sm:gap-6 z-30">
        <button className="lg:hidden text-slate-700 bg-slate-50 p-2 rounded-full hover:bg-slate-100 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-slate-800 leading-tight text-sm sm:text-base uppercase tracking-tight truncate">{unitTitle}</h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-bold truncate">{lessonName} • {gradeName}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 mx-auto min-w-[220px]">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">İlerleme</span>
          <div className="h-1.5 w-40 lg:w-56 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="text-xs font-black text-indigo-600 shrink-0">%{progressPercent}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          <Link
            href={`/karisik-test?lesson_id=${lessonId}&week=${week}`}
            className="flex h-9 items-center gap-1.5 rounded-full bg-amber-50 border border-amber-100 px-3 sm:px-4 text-xs font-black text-amber-600 shadow-sm hover:bg-amber-100 transition-colors"
          >
            <Trophy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mini Test</span>
          </Link>

          <Link
            href="/profil"
            title="Ayarlar"
            className="h-9 w-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden relative">

        {/* MOBILE OVERLAY */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* LEFT SIDEBAR: İÇİNDEKİLER (o ünitedeki konular) */}
        <aside className={`
          fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200
          transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${tocCollapsed ? 'lg:w-[76px]' : 'lg:w-[280px]'}
        `}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            {!tocCollapsed && (
              <Link
                href={overviewHref}
                className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Müfredata Dön
              </Link>
            )}
            <button
              type="button"
              onClick={() => setTocCollapsed((v) => !v)}
              className="hidden lg:flex text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50 ml-auto"
            >
              {tocCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {!tocCollapsed && (
            <div className="px-4 pt-3 pb-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest shrink-0">
              İçindekiler
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1" style={{ scrollbarWidth: 'none' }}>
            {!tocCollapsed && contents.length > 0 && (
              <div className="mx-0.5 mb-2 flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-xs font-black text-slate-700 truncate">{unitTitle}</span>
              </div>
            )}
            {contents.length > 0 ? contents.map((topic, idx) => {
              const isActive = idx === selectedTopicIndex;
              const isCompleted = idx < selectedTopicIndex;
              const showAdminMenu = isAdmin && !tocCollapsed;
              const hasSections = !!topic.sections?.length;
              const isTopicExpanded = expandedTopicIds.has(String(topic.id));
              const showExpandToggle = hasSections && !tocCollapsed;
              const showSectionTree = showExpandToggle && isTopicExpanded;
              const rightControlsCount = (showExpandToggle ? 1 : 0) + (showAdminMenu ? 1 : 0);
              const { Icon: TopicIcon, bg: topicBg, text: topicText } = getTopicStyle(idx);
              return (
                <div key={topic.id}>
                <div className="relative">
                  <button
                    onClick={() => goToTopic(idx)}
                    title={topic.title}
                    className={`
                      w-full flex items-center gap-3 rounded-xl transition-all duration-200 border text-left
                      ${tocCollapsed ? 'justify-center p-2.5' : 'p-2.5'}
                      ${rightControlsCount === 2 ? 'pr-14' : rightControlsCount === 1 ? 'pr-8' : ''}
                      ${isActive
                        ? 'bg-indigo-50/80 border-indigo-100/80 shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'}
                    `}
                  >
                    <div className={`
                      h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
                      ${isCompleted ? 'bg-emerald-100' : isActive ? topicBg : 'bg-slate-100'}
                    `}>
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TopicIcon className={`h-4 w-4 ${isActive ? topicText : 'text-slate-400'}`} />
                      )}
                    </div>
                    {!tocCollapsed && (
                      <>
                        <h4 className={`flex-1 min-w-0 text-sm font-bold leading-snug line-clamp-2 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {topic.title}
                        </h4>
                        <span className="shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : isActive ? (
                            <span className="block h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                          ) : (
                            <span className="block h-2.5 w-2.5 rounded-full border-2 border-slate-300" />
                          )}
                        </span>
                      </>
                    )}
                  </button>

                  {(showExpandToggle || showAdminMenu) && (
                    <div className="absolute right-1 top-1 flex items-center gap-0.5">
                      {showExpandToggle && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTopicExpanded(topic.id);
                          }}
                          title={isTopicExpanded ? 'Alt başlıkları gizle' : 'Alt başlıkları göster'}
                          className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isTopicExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}

                      {showAdminMenu && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTopicMenuOpenId((cur) => (String(cur) === String(topic.id) ? null : topic.id));
                            }}
                            className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {String(topicMenuOpenId) === String(topic.id) && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setTopicMenuOpenId(null)} />
                              <div className="absolute right-0 top-7 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTopicMenuOpenId(null);
                                    setPlanModalTopicId(Number(topic.id));
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  <Clipboard className="h-3.5 w-3.5" /> Alt Başlık Planı Prompt&apos;u
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTopicMenuOpenId(null);
                                    setManagingTopicId(Number(topic.id));
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  <Sparkles className="h-3.5 w-3.5" /> Kazanım / Kapak / Vurgular
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {showSectionTree && (
                  <div className="ml-8 mt-1 mb-2 border-l border-slate-200 pl-3 space-y-0.5">
                    {topic.sections!.map((section, sIdx) => {
                      const isSectionActive = String(currentSection?.id) === String(section.id);
                      return (
                        <div key={section.id} className="relative">
                          <button
                            type="button"
                            onClick={() => goToSection(idx, section.id)}
                            title={section.heading}
                            className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${isAdmin ? 'pr-7' : ''} ${
                              isSectionActive
                                ? 'bg-indigo-100 text-indigo-700 font-black'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                            }`}
                          >
                            {sIdx + 1}. {section.heading}
                          </button>

                          {isAdmin && (
                            <div className="absolute right-0.5 top-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSectionModalTarget({
                                    topicId: Number(topic.id),
                                    section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt },
                                  });
                                }}
                                className="h-5 w-5 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                                title="Alt başlık içerik promptu"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              );
            }) : (
              <div className="text-center p-4 text-sm text-slate-400 font-medium">Konular yükleniyor...</div>
            )}
          </div>

        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex min-h-0 flex-col overflow-hidden bg-slate-50">
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="max-w-5xl mx-auto p-3 sm:p-5 lg:p-8">

              {/* Breadcrumb */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-400 mb-4">
                <Link href="/" className="hover:text-indigo-600 transition-colors">Anasayfa</Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link href={`/${gradeSlug}`} className="hover:text-indigo-600 transition-colors">{gradeName}</Link>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link href={overviewHref} className="hover:text-indigo-600 transition-colors">{lessonName}</Link>
              </div>

              {/* Mobile Topics Dropdown */}
              <div className="md:hidden mb-4">
                <select
                  value={String(selectedTopicId || '')}
                  onChange={(e) => setActiveTopicId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {contents.map((topic, idx) => (
                    <option key={topic.id} value={String(topic.id)}>
                      {idx + 1}. {topic.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`grid grid-cols-1 gap-5 items-start ${currentSection ? '' : 'lg:grid-cols-[1fr_260px]'}`}>
                {/* CONTENT CARD */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 min-w-0">
                  <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 rounded-t-2xl border-b border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {activeTopic && (() => {
                        const { Icon: HeaderIcon, bg: headerBg, text: headerText } = getTopicStyle(selectedTopicIndex);
                        return (
                          <div className={`hidden sm:flex h-11 w-11 rounded-2xl items-center justify-center shrink-0 ${headerBg}`}>
                            <HeaderIcon className={`h-5 w-5 ${headerText}`} />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-wider">
                          {totalTopics ? `${selectedTopicIndex + 1}. ` : ''}Konu
                        </p>
                        <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 leading-tight line-clamp-2">
                          {activeTopic?.title || 'Konu Seçin'}
                        </h2>
                        {activeTopic?.subtitle && (
                          <p className="text-xs text-slate-500 font-semibold mt-0.5 truncate">{activeTopic.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      title="Sesli anlatım yakında eklenecek"
                      className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-full border border-indigo-100 bg-white text-indigo-600 text-xs font-black shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Volume2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sesli Anlatım</span>
                    </button>
                  </div>

                  <div ref={contentRef} className="p-5 sm:p-8 lg:p-10">
                    {!currentSection && activeTopic?.heroImageUrl && (
                      <div className="not-prose mb-8 rounded-2xl overflow-hidden border border-slate-100 shadow-sm aspect-[16/9]">
                        <img src={activeTopic.heroImageUrl} alt={activeTopic.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    {activeTopic ? (
                      <div className="prose prose-sm sm:prose lg:prose-base max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-indigo-700 prose-strong:font-extrabold prose-ul:text-slate-700 prose-li:marker:text-indigo-400 prose-li:text-base prose-li:mb-1.5">
                        <div className="!mt-0 not-prose mb-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                          <BookOpen className="h-3.5 w-3.5" /> Konu Anlatımı
                        </div>
                        {activeTopic.sections && activeTopic.sections.length > 0 ? (
                          currentSection ? (
                            <div>
                              <button
                                type="button"
                                onClick={() => setActiveSectionId(null)}
                                className="not-prose mb-3 flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" /> Alt Başlıklara Dön
                              </button>
                              <h2 className="flex items-center gap-2.5 text-rose-600">
                                <span className="not-prose inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-sm font-black text-rose-600">
                                  {currentSectionIndex + 1}
                                </span>
                                {currentSection.heading}
                              </h2>
                              {(() => {
                                const body = currentSection.html ? (
                                  <div dangerouslySetInnerHTML={{ __html: currentSection.html }} />
                                ) : (
                                  <p className="not-prose text-sm text-slate-400 font-medium italic">İçerik hazırlanıyor.</p>
                                );

                                if (!currentSection.imageUrl) return body;

                                return (
                                  <div className="not-prose flex flex-col sm:flex-row gap-5 items-start">
                                    <img
                                      src={currentSection.imageUrl}
                                      alt={currentSection.heading}
                                      className="w-full sm:w-1/2 rounded-xl border border-slate-100 shadow-sm shrink-0"
                                    />
                                    <div className="flex-1 min-w-0 bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                                      {body}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="not-prose">
                              <p className="text-sm text-slate-500 font-medium mb-4">
                                Bu konudaki alt başlıklardan birini seçerek konu anlatımını görüntüleyebilirsin.
                              </p>
                              <div className="space-y-2">
                                {activeTopic.sections.map((section, idx) => (
                                  <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => goToSection(selectedTopicIndex, section.id)}
                                    className="w-full flex items-center gap-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/50 px-4 py-3.5 text-left shadow-sm transition-colors"
                                  >
                                    <span className="h-8 w-8 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black">
                                      {idx + 1}
                                    </span>
                                    <span className="flex-1 min-w-0 text-sm font-bold text-slate-700 truncate">{section.heading}</span>
                                    <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )
                        ) : activeTopic.content ? (
                          <div dangerouslySetInnerHTML={{ __html: activeTopic.content }} />
                        ) : isWeekDataLoading ? (
                          <div className="space-y-5 animate-pulse not-prose">
                            <div className="h-7 w-2/3 rounded-lg bg-slate-100" />
                            <div className="space-y-3">
                              <div className="h-4 w-full rounded bg-slate-100" />
                              <div className="h-4 w-11/12 rounded bg-slate-100" />
                              <div className="h-4 w-4/5 rounded bg-slate-100" />
                            </div>
                            <div className="h-28 rounded-2xl bg-slate-100" />
                          </div>
                        ) : (
                          <div className="text-center py-10 not-prose">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4">
                              <BookOpen className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-extrabold text-slate-800 mb-2">İçerik Hazırlanıyor</h3>
                            <p className="text-sm text-slate-500 font-medium">Bu konu için detaylı ders içeriği yakında eklenecektir.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">İçerik bulunamadı</p>
                      </div>
                    )}

                    {activeTopicOutcomes.length > 0 && (
                      <div className="mt-8 pt-6 border-t border-slate-100 not-prose">
                        <button
                          type="button"
                          onClick={() => setOutcomesOpen((v) => !v)}
                          className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                        >
                          <Target className="h-3.5 w-3.5" />
                          Kazanımlar
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${outcomesOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {outcomesOpen && (
                          <div className="mt-3 space-y-2">
                            {activeTopicOutcomes.map((o, idx) => (
                              <div key={o.id || idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">{o.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Vurgular + Biliyor musun? (sadece ana konu genel görünümünde) */}
                {!currentSection && (
                  <div className="flex flex-col gap-4 lg:sticky lg:top-4">
                    {activeTopic?.highlights && activeTopic.highlights.length > 0 && (
                      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest mb-3">
                          <Sparkles className="h-4 w-4" /> Bunları Biliyor musun?
                        </div>
                        <div className="space-y-2.5">
                          {activeTopic.highlights.map((h) => <HighlightCard key={h.position} highlight={h} />)}
                        </div>
                      </div>
                    )}
                    <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-widest mb-2">
                        <Lightbulb className="h-4 w-4" /> Biliyor musun?
                      </div>
                      <p className="text-sm text-amber-900/80 font-medium leading-relaxed">{studyTip}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER: Geri / İleri */}
          <footer className="shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBackward}
                disabled={isAtVeryStart}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed sm:px-6 sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Geri
              </button>

              <span className="text-xs sm:text-sm font-black text-slate-400">
                {currentSection
                  ? `${selectedTopicIndex + 1}. Konu • ${currentSectionIndex + 1}/${sections.length}`
                  : `${totalTopics ? selectedTopicIndex + 1 : 0} / ${totalTopics}`}
              </span>

              <button
                type="button"
                onClick={goForward}
                disabled={isAtVeryEnd}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20 disabled:opacity-40 disabled:cursor-not-allowed sm:px-6 sm:text-sm"
              >
                İleri <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </footer>
        </div>
      </div>

      {managingTopicId != null && (
        <AdminTopicSectionsModal
          topicId={managingTopicId}
          topicTitle={contents.find((c) => Number(c.id) === managingTopicId)?.title}
          onClose={() => setManagingTopicId(null)}
        />
      )}

      {planModalTopicId != null && (
        <PlanModal
          topicId={planModalTopicId}
          onClose={() => setPlanModalTopicId(null)}
          onSaved={() => {
            setPlanModalTopicId(null);
            refreshWeekData();
          }}
          onManageMore={() => {
            const topicId = planModalTopicId;
            setPlanModalTopicId(null);
            setManagingTopicId(topicId);
          }}
        />
      )}

      {sectionModalTarget && (
        <SectionModal
          topicId={sectionModalTarget.topicId}
          section={sectionModalTarget.section}
          onClose={() => setSectionModalTarget(null)}
          onSaved={() => {
            setSectionModalTarget(null);
            refreshWeekData();
          }}
          onImageChanged={refreshWeekData}
        />
      )}
    </div>
  );
}
