'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/src/context/AuthContext';
import {
  ChevronRight,
  ChevronLeft,
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
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Sparkles,
  ListChecks,
} from 'lucide-react';
import AdminTopicSectionsModal from '@/app/src/components/admin/AdminTopicSectionsModal';
import { PlanModal, SectionModal, QuestionsModal, type SectionModalSection } from '@/app/src/components/admin/AdminTopicSectionsPanel';
import SectionContent from './SectionContent';

type Outcome = { id?: string | number; description: string; topicId?: string | number | null };
type TopicSection = { id: string | number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null };
type TopicHighlight = { position: string; icon: string | null; title: string; description: string };
type Content = {
  id: string | number;
  title: string;
  slug?: string | null;
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

// Genel amaçlı, TTL'li localStorage önbelleği. Herhangi bir veri için (sadece
// ünite konuları değil) sayfa açılışını yavaşlatmadan arkaplanda önceden
// yükleyip birkaç gün boyunca saklamak istediğimizde tekrar kullanılabilir.
function readPersistentCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; savedAt: number };
    if (!parsed || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writePersistentCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage dolu/erişilemez olabilir; sessizce yoksay, sadece bellek içi önbellek kullanılır
  }
}

const UNIT_TOPICS_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 gün

function unitTopicsCacheKey(gradeId: string, lessonId: string, unitId: number | string) {
  return `ders-unit-topics:${gradeId}:${lessonId}:${unitId}`;
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

  const pickInitialTopicId = (contentsList: Content[], topicSlug: string | null) => {
    if (topicSlug) {
      const bySlug = contentsList.find((c) => c.slug === topicSlug);
      if (bySlug) return bySlug.id;
    }
    return contentsList[0]?.id ?? null;
  };

  const [units, setUnits] = useState<Unit[]>(initialData.units || []);
  const [, setOutcomes] = useState<Outcome[]>(initialData.outcomes);
  const [contents, setContents] = useState<Content[]>(initialData.contents);
  const [isWeekDataLoading, setIsWeekDataLoading] = useState(true);
  const [activeTopicId, setActiveTopicId] = useState<string | number | null>(
    pickInitialTopicId(initialData.contents, initialData.topicSlug)
  );
  const [activeSectionId, setActiveSectionId] = useState<string | number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileTopicMenuOpen, setMobileTopicMenuOpen] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [kazanimlarOpen, setKazanimlarOpen] = useState(false);
  const [kazanimlarWeek, setKazanimlarWeek] = useState(week);
  const [kazanimlarCache, setKazanimlarCache] = useState<Record<number, Outcome[]>>({});
  const [kazanimlarLoadingWeek, setKazanimlarLoadingWeek] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topicMenuOpenId, setTopicMenuOpenId] = useState<string | number | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  const [manualUnitId, setManualUnitId] = useState<number | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [unitTopicsCache, setUnitTopicsCache] = useState<Record<string, Content[]>>({});
  const [loadingUnitIds, setLoadingUnitIds] = useState<Set<string>>(new Set());
  const [managingTopicId, setManagingTopicId] = useState<number | null>(null);
  const [planModalTopicId, setPlanModalTopicId] = useState<number | null>(null);
  const [sectionModalTarget, setSectionModalTarget] = useState<{ topicId: number; section: SectionModalSection } | null>(null);
  const [sectionMenuOpenId, setSectionMenuOpenId] = useState<string | number | null>(null);
  const [questionsModalTarget, setQuestionsModalTarget] = useState<{ topicId: number; section: { id: number; heading: string } } | null>(null);
  const [sectionQuestionCount, setSectionQuestionCount] = useState<number | null>(null);
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

  useEffect(() => {
    const hasContent = !!(currentSection?.html || currentSection?.imageUrl);
    if (!currentSection || !hasContent) {
      setSectionQuestionCount(null);
      return;
    }
    let cancelled = false;
    setSectionQuestionCount(null);
    fetch(`/api/section-test-questions?sectionId=${currentSection.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions?: unknown[] } | null) => {
        if (!cancelled) setSectionQuestionCount(data?.questions?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) setSectionQuestionCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentSection]);

  const studyTip = STUDY_TIPS[selectedTopicIndex % STUDY_TIPS.length];

  // Akordeon: sadece seçili konunun alt başlıkları açık kalsın, diğer konularınki kapansın
  useEffect(() => {
    if (selectedTopicId == null) return;
    setExpandedTopicIds(new Set([String(selectedTopicId)]));
  }, [selectedTopicId]);

  const toggleTopicExpanded = (id: string | number) => {
    const key = String(id);
    setExpandedTopicIds((prev) => (prev.has(key) ? new Set() : new Set([key])));
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

  const activeUnit =
    (manualUnitId != null ? units.find((u) => u.id === manualUnitId) : null) ||
    (initialData.unitSlug ? units.find((u) => u.slug === initialData.unitSlug) : null) ||
    units.find(u => week >= (u.start_week || 1) && week <= (u.end_week || 38)) ||
    units[0];

  const sortedUnits = useMemo(
    () => [...units].sort((a, b) => a.order_no - b.order_no),
    [units]
  );
  const unitTitle = activeUnit?.title || unitName || 'Ünite Bulunamadı';

  // Aktif ünite değiştikçe sidebar index'inde SADECE o ünite açık kalsın (akordeon)
  useEffect(() => {
    if (activeUnit?.id == null) return;
    setExpandedUnitIds(new Set([String(activeUnit.id)]));
  }, [activeUnit?.id]);

  // Aktif ünitenin konuları zaten yükleniyor (contents); index önbelleğine (bellek + localStorage) de yansıt
  useEffect(() => {
    if (activeUnit?.id == null) return;
    setUnitTopicsCache((prev) => ({ ...prev, [String(activeUnit.id)]: contents }));
    if (contents.length) {
      writePersistentCache(unitTopicsCacheKey(gradeId, lessonId, activeUnit.id), contents);
    }
  }, [activeUnit?.id, contents, gradeId, lessonId]);

  // Diğer effect/callback'lerin, ortasında bulundukları render'ın eski (stale)
  // unitTopicsCache kopyasını değil her zaman en güncelini görebilmesi için
  const unitTopicsCacheRef = useRef(unitTopicsCache);
  useEffect(() => {
    unitTopicsCacheRef.current = unitTopicsCache;
  }, [unitTopicsCache]);

  // Arka plan ısıtma döngüsü ile kullanıcının manuel tıklaması aynı üniteyi
  // aynı anda isteyebilir; bu ref ile aynı isteği paylaşıp mükerrer fetch'i önlüyoruz.
  const inFlightUnitFetchesRef = useRef<Record<string, Promise<Content[]> | undefined>>({});

  const ensureUnitTopicsLoaded = (unit: Unit): Promise<Content[]> => {
    const key = String(unit.id);
    if (unitTopicsCacheRef.current[key]) return Promise.resolve(unitTopicsCacheRef.current[key]);

    const persisted = readPersistentCache<Content[]>(unitTopicsCacheKey(gradeId, lessonId, unit.id), UNIT_TOPICS_CACHE_TTL_MS);
    if (persisted) {
      setUnitTopicsCache((prev) => ({ ...prev, [key]: persisted }));
      return Promise.resolve(persisted);
    }

    if (inFlightUnitFetchesRef.current[key]) {
      return inFlightUnitFetchesRef.current[key];
    }

    const fetchPromise = (async (): Promise<Content[]> => {
      setLoadingUnitIds((prev) => new Set(prev).add(key));
      try {
        const params = new URLSearchParams({
          gradeId,
          lessonId,
          unitId: String(unit.id),
          week: String(unit.start_week || week),
        });
        const response = await fetch(`/api/lesson-week-data?${params.toString()}`);
        if (!response.ok) return [];
        const data = await response.json() as { contents?: Content[] };
        const topics = data.contents || [];
        setUnitTopicsCache((prev) => ({ ...prev, [key]: topics }));
        writePersistentCache(unitTopicsCacheKey(gradeId, lessonId, unit.id), topics);
        return topics;
      } catch (error) {
        console.error('Ünite konuları yüklenemedi:', error);
        return [];
      } finally {
        setLoadingUnitIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        delete inFlightUnitFetchesRef.current[key];
      }
    })();

    inFlightUnitFetchesRef.current[key] = fetchPromise;
    return fetchPromise;
  };

  // Sayfa ilk içeriğini yükledikten SONRA (arkaplanda, tek seferlik), henüz
  // önbellekte olmayan ünitelerin konularını sırayla arka planda ısıtır —
  // böylece kullanıcı bir üniteye tıkladığında beklemeden açılır. İlk sayfa
  // yüklemesini yavaşlatmamak için isWeekDataLoading false olana kadar başlamaz.
  const hasStartedBackgroundPrefetchRef = useRef(false);
  useEffect(() => {
    if (isWeekDataLoading) return;
    if (hasStartedBackgroundPrefetchRef.current) return;
    if (!sortedUnits.length) return;
    hasStartedBackgroundPrefetchRef.current = true;

    let cancelled = false;
    (async () => {
      for (const unit of sortedUnits) {
        if (cancelled) return;
        const key = String(unit.id);
        if (unitTopicsCacheRef.current[key]) continue;

        const persisted = readPersistentCache<Content[]>(unitTopicsCacheKey(gradeId, lessonId, unit.id), UNIT_TOPICS_CACHE_TTL_MS);
        if (persisted) {
          setUnitTopicsCache((prev) => (prev[key] ? prev : { ...prev, [key]: persisted }));
          continue;
        }

        await ensureUnitTopicsLoaded(unit);
        if (cancelled) return;
        // arkaplan yüklemesi ağı/tarayıcıyı boğmasın diye istekler arasında küçük bir bekleme
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeekDataLoading, sortedUnits, gradeId, lessonId]);

  // Üniteye tıklayınca: zaten aktifse sadece aç/kapa; değilse o üniteyi aktif yap
  // ve ilk konusunu otomatik seç (aktif görünmesi için içerik de değişir),
  // ama mobilde sidebar'ı kapatma — kullanıcı gezinmeye devam edebilsin.
  const handleUnitHeaderClick = async (unit: Unit) => {
    const key = String(unit.id);

    if (String(unit.id) === String(activeUnit?.id)) {
      setExpandedUnitIds((prev) => (prev.has(key) ? new Set() : new Set([key])));
      return;
    }

    const topics = unitTopicsCacheRef.current[key] || (await ensureUnitTopicsLoaded(unit));
    const firstTopic = topics[0];
    if (firstTopic) {
      setContents(topics);
      setActiveTopicId(firstTopic.id);
      setActiveSectionId(null);
    }
    setManualUnitId(Number(unit.id));
  };

  const selectUnitTopic = (unit: Unit, topicId: string | number) => {
    if (String(unit.id) !== String(activeUnit?.id)) {
      const cached = unitTopicsCache[String(unit.id)];
      if (cached) setContents(cached);
      setManualUnitId(Number(unit.id));
    }
    setActiveTopicId(topicId);
    setActiveSectionId(null);
    setSidebarOpen(false);
  };

  const selectUnitSection = (unit: Unit, topicId: string | number, sectionId: string | number) => {
    if (String(unit.id) !== String(activeUnit?.id)) {
      const cached = unitTopicsCache[String(unit.id)];
      if (cached) setContents(cached);
      setManualUnitId(Number(unit.id));
    }
    setActiveTopicId(topicId);
    setActiveSectionId(sectionId);
    setSidebarOpen(false);
  };

  const totalTopics = contents.length;
  const progressPercent = totalTopics ? Math.round(((selectedTopicIndex + 1) / totalTopics) * 100) : 0;

  const totalWeeks = initialData.totalWeeks || 38;

  const openKazanimlarModal = () => {
    setKazanimlarWeek(week);
    setKazanimlarOpen(true);
  };

  const goToKazanimlarWeek = (targetWeek: number) => {
    if (targetWeek < 1 || targetWeek > totalWeeks) return;
    setKazanimlarWeek(targetWeek);
  };

  useEffect(() => {
    if (!kazanimlarOpen) return;
    if (kazanimlarCache[kazanimlarWeek]) return;
    const unitForWeek = units.find((u) => kazanimlarWeek >= (u.start_week || 1) && kazanimlarWeek <= (u.end_week || 38));
    if (!unitForWeek) return;

    let cancelled = false;
    setKazanimlarLoadingWeek(kazanimlarWeek);
    const params = new URLSearchParams({
      gradeId,
      lessonId,
      unitId: String(unitForWeek.id),
      week: String(kazanimlarWeek),
    });
    fetch(`/api/lesson-week-data?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { outcomes?: Outcome[] } | null) => {
        if (cancelled) return;
        setKazanimlarCache((prev) => ({ ...prev, [kazanimlarWeek]: data?.outcomes || [] }));
      })
      .catch(() => {
        if (!cancelled) setKazanimlarCache((prev) => ({ ...prev, [kazanimlarWeek]: [] }));
      })
      .finally(() => {
        if (!cancelled) setKazanimlarLoadingWeek((w) => (w === kazanimlarWeek ? null : w));
      });
    return () => {
      cancelled = true;
    };
  }, [kazanimlarOpen, kazanimlarWeek, kazanimlarCache, gradeId, lessonId, units]);

  const kazanimlarTouchStartX = useRef<number | null>(null);
  const handleKazanimlarTouchStart = (e: React.TouchEvent) => {
    kazanimlarTouchStartX.current = e.touches[0].clientX;
  };
  const handleKazanimlarTouchEnd = (e: React.TouchEvent) => {
    if (kazanimlarTouchStartX.current == null) return;
    const deltaX = e.changedTouches[0].clientX - kazanimlarTouchStartX.current;
    kazanimlarTouchStartX.current = null;
    const threshold = 50;
    if (deltaX > threshold) goToKazanimlarWeek(kazanimlarWeek - 1);
    else if (deltaX < -threshold) goToKazanimlarWeek(kazanimlarWeek + 1);
  };

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedTopicId]);

  // Görüntülenen konu değiştikçe adres çubuğunu (yeniden yükleme yapmadan) senkronize et
  useEffect(() => {
    if (!gradeSlug || !lessonSlug || !activeUnit?.slug || !activeTopic?.slug) return;
    const url = `/${gradeSlug}/${lessonSlug}/${activeUnit.slug}/${activeTopic.slug}`;
    if (window.location.pathname !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [gradeSlug, lessonSlug, activeUnit?.slug, activeTopic?.slug]);

  useEffect(() => {
    setUnits(initialData.units || []);
    setContents(initialData.contents);
    setOutcomes(initialData.outcomes);
    setActiveTopicId(pickInitialTopicId(initialData.contents, initialData.topicSlug));
    setIsWeekDataLoading(true);
    setManualUnitId(null);
    setKazanimlarWeek(week);
    setKazanimlarCache({});
  }, [initialData, week]);

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

  const runViewTransition = (direction: 'forward' | 'backward', update: () => void) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (!doc.startViewTransition) {
      update();
      return;
    }
    document.documentElement.setAttribute('data-nav-direction', direction);
    const transition = doc.startViewTransition(update);
    transition.finished.finally(() => {
      document.documentElement.removeAttribute('data-nav-direction');
    });
  };

  const goForward = () => {
    const container = contentRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= 4;
      if (!isAtBottom) {
        container.scrollBy({ top: clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
    }
    runViewTransition('forward', () => {
      if (sections.length) {
        if (currentSection) {
          if (currentSectionIndex < sections.length - 1) {
            setActiveSectionId(sections[currentSectionIndex + 1].id);
            contentRef.current?.scrollTo({ top: 0 });
            return;
          }
          goToTopic(selectedTopicIndex + 1);
          return;
        }
        setActiveSectionId(sections[0].id);
        contentRef.current?.scrollTo({ top: 0 });
        return;
      }
      goToTopic(selectedTopicIndex + 1);
    });
  };

  const goBackward = () => {
    const container = contentRef.current;
    if (container) {
      const isAtTop = container.scrollTop <= 4;
      if (!isAtTop) {
        container.scrollBy({ top: -container.clientHeight * 0.9, behavior: 'smooth' });
        return;
      }
    }
    runViewTransition('backward', () => {
      if (sections.length && currentSection) {
        if (currentSectionIndex > 0) {
          setActiveSectionId(sections[currentSectionIndex - 1].id);
        } else {
          setActiveSectionId(null);
        }
        contentRef.current?.scrollTo({ top: 0 });
        return;
      }
      const prevTopic = contents[selectedTopicIndex - 1];
      if (!prevTopic) return;
      setActiveTopicId(prevTopic.id);
      const prevSections = prevTopic.sections || [];
      setActiveSectionId(prevSections.length ? prevSections[prevSections.length - 1].id : null);
    });
  };

  const isAtVeryStart = selectedTopicIndex <= 0 && !currentSection;
  const isAtVeryEnd = selectedTopicIndex >= totalTopics - 1
    && (!sections.length || (!!currentSection && currentSectionIndex >= sections.length - 1));

  const renderTopicItem = (topic: Content, idx: number, unit: Unit, isActiveUnitList: boolean) => {
    const isActive = isActiveUnitList && idx === selectedTopicIndex;
    const isCompleted = isActiveUnitList && idx < selectedTopicIndex;
    const showAdminMenu = isAdmin && !tocCollapsed;
    const hasSections = !!topic.sections?.length;
    const isTopicExpanded = expandedTopicIds.has(String(topic.id));
    const showExpandToggle = hasSections && !tocCollapsed;
    const showSectionTree = showExpandToggle && isTopicExpanded;
    const rightControlsCount = (showExpandToggle ? 1 : 0) + (showAdminMenu ? 1 : 0);

    const handleTopicClick = () => {
      if (isActiveUnitList) {
        goToTopic(idx);
      } else {
        selectUnitTopic(unit, topic.id);
      }
    };

    const handleSectionClick = (sectionId: string | number) => {
      if (isActiveUnitList) {
        goToSection(idx, sectionId);
      } else {
        selectUnitSection(unit, topic.id, sectionId);
      }
    };

    return (
      <div key={topic.id}>
      <div className="relative">
        <button
          onClick={handleTopicClick}
          title={topic.title}
          className={`
            w-full flex items-center gap-3 rounded-xl transition-colors duration-200 text-left
            ${tocCollapsed ? 'justify-center p-2.5' : 'p-2.5'}
            ${rightControlsCount === 2 ? 'pr-14' : rightControlsCount === 1 ? 'pr-8' : ''}
            ${isActive ? 'bg-violet-50/80' : 'hover:bg-slate-50'}
          `}
        >
          {tocCollapsed ? (
            <div className={`
              h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black transition-colors
              ${isCompleted ? 'bg-emerald-100 text-emerald-600' : isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'}
            `}>
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </div>
          ) : (
            <>
              <h4 className={`flex-1 min-w-0 text-xs font-bold leading-snug line-clamp-2 ${isActive ? 'text-violet-900' : 'text-slate-700'}`}>
                {topic.title}
              </h4>
              <span className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isActive ? (
                  <span className="block h-2.5 w-2.5 rounded-full bg-violet-500 ring-4 ring-violet-100" />
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
            const isSectionActive = isActiveUnitList && String(currentSection?.id) === String(section.id);
            return (
              <div key={section.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleSectionClick(section.id)}
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
                        setSectionMenuOpenId((cur) => (String(cur) === String(section.id) ? null : section.id));
                      }}
                      className="h-5 w-5 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>

                    {String(sectionMenuOpenId) === String(section.id) && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setSectionMenuOpenId(null)} />
                        <div className="absolute right-0 top-6 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setSectionModalTarget({
                                topicId: Number(topic.id),
                                section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt },
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <Clipboard className="h-3.5 w-3.5" /> İçerik Prompt&apos;u
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setQuestionsModalTarget({
                                topicId: Number(topic.id),
                                section: { id: Number(section.id), heading: section.heading },
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <ListChecks className="h-3.5 w-3.5" /> Soru Ekle
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col bg-[#f9fafb] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

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
          <button
            type="button"
            onClick={openKazanimlarModal}
            className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 sm:px-4 text-xs font-black text-emerald-600 shadow-sm hover:bg-emerald-100 transition-colors"
          >
            <Target className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Kazanımlar</span>
          </button>

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

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1" style={{ scrollbarWidth: 'none' }}>
            {tocCollapsed ? (
              contents.length > 0 ? contents.map((topic, idx) => renderTopicItem(topic, idx, activeUnit as Unit, true)) : (
                <div className="text-center p-4 text-sm text-slate-400 font-medium">Konular yükleniyor...</div>
              )
            ) : sortedUnits.length > 0 ? sortedUnits.map((unit) => {
              const isActiveUnit = String(unit.id) === String(activeUnit?.id);
              const unitKey = String(unit.id);
              const isUnitExpanded = expandedUnitIds.has(unitKey);
              const unitTopics = isActiveUnit ? contents : (unitTopicsCache[unitKey] || []);
              const isLoadingUnit = loadingUnitIds.has(unitKey);
              return (
                <div key={unit.id} className="mb-1">
                  <button
                    type="button"
                    onClick={() => handleUnitHeaderClick(unit)}
                    className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isActiveUnit ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActiveUnit ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <span className={`flex-1 min-w-0 truncate text-xs font-black uppercase tracking-wide ${isActiveUnit ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {unit.title}
                    </span>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isUnitExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isUnitExpanded && (
                    <div className="ml-3 mt-1 mb-2 space-y-1 border-l border-slate-200 pl-3">
                      {isLoadingUnit && !unitTopics.length ? (
                        <div className="px-3 py-2 text-xs font-medium text-slate-400">Yükleniyor...</div>
                      ) : unitTopics.length === 0 ? (
                        <div className="px-3 py-2 text-xs font-medium text-slate-400">Konu bulunamadı</div>
                      ) : (
                        unitTopics.map((topic, idx) => renderTopicItem(topic, idx, unit, isActiveUnit))
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center p-4 text-sm text-slate-400 font-medium">Üniteler yükleniyor...</div>
            )}
          </div>

          {/* Ana footer ile aynı hizada kalsın diye eşleşen boş şerit */}
          <div className="hidden lg:block h-16 shrink-0 border-t border-slate-200/80 bg-white/95" />

        </aside>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex min-h-0 flex-col overflow-hidden bg-slate-50">
          <div ref={contentRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
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
              <div className="md:hidden mb-4 relative">
                <button
                  type="button"
                  onClick={() => setMobileTopicMenuOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider">
                      {selectedTopicIndex + 1}. Konu{currentSection ? ` • ${currentSectionIndex + 1}. Alt Başlık` : ''}
                    </span>
                    <span className="block text-sm font-bold text-slate-800 truncate">
                      {currentSection ? currentSection.heading : activeTopic?.title}
                    </span>
                  </span>
                  <ChevronRight className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${mobileTopicMenuOpen ? 'rotate-90' : ''}`} />
                </button>

                {mobileTopicMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMobileTopicMenuOpen(false)} />
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl space-y-1">
                      {contents.map((topic, idx) => {
                        const isActiveTopic = idx === selectedTopicIndex;
                        const hasSections = !!topic.sections?.length;
                        const isExpanded = expandedTopicIds.has(String(topic.id));
                        return (
                          <div key={topic.id} className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                goToTopic(idx);
                                setMobileTopicMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-2 rounded-lg py-2.5 pl-3 text-left text-sm font-bold transition-colors ${hasSections ? 'pr-9' : 'pr-3'} ${
                                isActiveTopic && !currentSection ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex-1 min-w-0 truncate">{idx + 1}. {topic.title}</span>
                            </button>

                            {hasSections && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTopicExpanded(topic.id);
                                }}
                                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                              >
                                <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            )}

                            {hasSections && isExpanded && (
                              <div className="ml-4 mb-1 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
                                {topic.sections!.map((section, sIdx) => {
                                  const isActiveSection = isActiveTopic && String(currentSection?.id) === String(section.id);
                                  return (
                                    <button
                                      key={section.id}
                                      type="button"
                                      onClick={() => {
                                        goToSection(idx, section.id);
                                        setMobileTopicMenuOpen(false);
                                      }}
                                      className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                                        isActiveSection ? 'bg-indigo-100 text-indigo-700 font-black' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                                      }`}
                                    >
                                      {sIdx + 1}. {section.heading}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className={`grid grid-cols-1 gap-5 items-start ${currentSection ? '' : 'lg:grid-cols-[1fr_260px]'}`}>
                {/* CONTENT CARD */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 min-w-0" style={{ viewTransitionName: 'ders-content' }}>
                  <div className="p-5 sm:p-8 lg:p-10">
                    {!currentSection && activeTopic?.heroImageUrl && (
                      <div className="not-prose mb-8 rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                        <img src={activeTopic.heroImageUrl} alt={activeTopic.title} className="w-full max-h-[420px] object-contain" />
                      </div>
                    )}
                    {activeTopic ? (
                      <div className="prose prose-sm sm:prose lg:prose-base max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-indigo-700 prose-strong:font-extrabold prose-ul:text-slate-700 prose-li:marker:text-indigo-400 prose-li:text-base prose-li:mb-1.5">
                        {activeTopic.sections && activeTopic.sections.length > 0 ? (
                          currentSection ? (
                            <div>
                              <h2 className="flex items-center gap-2.5 text-rose-600">
                                <span className="not-prose inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-sm font-black text-rose-600">
                                  {currentSectionIndex + 1}
                                </span>
                                {currentSection.heading}
                              </h2>
                              {currentSection.html || currentSection.imageUrl ? (
                                <>
                                  <SectionContent
                                    key={currentSection.id}
                                    html={currentSection.html || ''}
                                    imageUrl={currentSection.imageUrl}
                                    caption={currentSection.heading}
                                  />
                                  {sectionQuestionCount !== 0 && (
                                    <Link
                                      href={`/ders/alt-baslik-test?sectionId=${currentSection.id}`}
                                      className="not-prose mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-100 bg-amber-50 py-3 text-sm font-black text-amber-700 transition-colors hover:bg-amber-100"
                                    >
                                      <Trophy className="h-4 w-4" /> Bu Konuyla İlgili Sorular Çöz
                                      {sectionQuestionCount != null && (
                                        <span className="inline-flex items-center justify-center rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-black text-amber-800">
                                          {sectionQuestionCount} Soru
                                        </span>
                                      )}
                                    </Link>
                                  )}
                                </>
                              ) : (
                                <p className="not-prose text-sm text-slate-400 font-medium italic">İçerik hazırlanıyor.</p>
                              )}
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
                          <SectionContent html={activeTopic.content} />
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

      {kazanimlarOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setKazanimlarOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleKazanimlarTouchStart}
            onTouchEnd={handleKazanimlarTouchEnd}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="h-4 w-4 text-emerald-600 shrink-0" />
                <h3 className="text-sm font-black text-slate-800 truncate">{kazanimlarWeek}. Hafta Kazanımları</h3>
              </div>
              <button
                type="button"
                onClick={() => setKazanimlarOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => goToKazanimlarWeek(kazanimlarWeek - 1)}
                disabled={kazanimlarWeek <= 1}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Hafta {kazanimlarWeek} / {totalWeeks}</span>
              <button
                type="button"
                onClick={() => goToKazanimlarWeek(kazanimlarWeek + 1)}
                disabled={kazanimlarWeek >= totalWeeks}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
              {kazanimlarLoadingWeek === kazanimlarWeek ? (
                <div className="py-10 text-center text-sm font-medium text-slate-400">Yükleniyor...</div>
              ) : (kazanimlarCache[kazanimlarWeek]?.length ?? 0) === 0 ? (
                <div className="py-10 text-center text-sm font-medium text-slate-400">Bu hafta için kazanım bulunamadı.</div>
              ) : (
                kazanimlarCache[kazanimlarWeek]!.map((o, idx) => (
                  <div key={o.id || idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{o.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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

      {questionsModalTarget && (
        <QuestionsModal
          topicId={questionsModalTarget.topicId}
          section={questionsModalTarget.section}
          onClose={() => setQuestionsModalTarget(null)}
        />
      )}
    </div>
  );
}
