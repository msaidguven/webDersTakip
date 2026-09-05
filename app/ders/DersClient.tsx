'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/src/context/AuthContext';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Menu,
  X,
  Clipboard,
  Check,
  MoreVertical,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Sparkles,
  ListChecks,
  Pencil,
  ImagePlus,
  Shapes,
  Plus,
} from 'lucide-react';
import type {
  SectionModalSection,
  EditableSection,
} from '@/app/src/components/admin/AdminTopicSectionsPanel';

// Admin düzenleme paneli (~3000 satır) ve modalları sadece admin gerçekten bir
// düzenleme aksiyonu tetiklediğinde indirilsin diye lazy-load ediliyor; aksi halde
// bu kod her öğrencinin konu sayfası ziyaretinde ana bundle'a dahil oluyordu.
const AdminTopicSectionsModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsModal'), { ssr: false });
const PlanModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.PlanModal), { ssr: false });
const NotebookPlanModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.NotebookPlanModal), { ssr: false });
const SectionModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.SectionModal), { ssr: false });
const QuestionsModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.QuestionsModal), { ssr: false });
const ImageModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.ImageModal), { ssr: false });
const DiagramModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.DiagramModal), { ssr: false });
const SectionContentEditModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.SectionContentEditModal), { ssr: false });
const TopicCoverImageModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.TopicCoverImageModal), { ssr: false });
const TopicHighlightsModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.TopicHighlightsModal), { ssr: false });
const TopicQuestionsModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.TopicQuestionsModal), { ssr: false });
const ClassicalGenerateModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.ClassicalGenerateModal), { ssr: false });
const TopicHighlightQuickAddModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.TopicHighlightQuickAddModal), { ssr: false });
const TopicHighlightEditModal = dynamic(() => import('@/app/src/components/admin/AdminTopicSectionsPanel').then((m) => m.TopicHighlightEditModal), { ssr: false });
import { formatWeekDateRangeLabel, getWeekDateRange, getCurriculumWeekFromDate, resolveTeachingWeek, teachingWeekToCalendarWeek, calendarWeeksBetween, type CurriculumBreak } from '@/app/src/lib/routeParsing';
import { getLessonColor } from '@/app/src/lib/homeMapping';
import SectionContent from './SectionContent';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import { CurriculumWeekCard, HighlightCard, TopicCompleteButton, QuizCtaCards } from './DersClientCards';
import {
  type Outcome,
  type WeekedOutcome,
  type SpecialWeekEvent,
  type TopicSection,
  type TopicHighlight,
  type Content,
  type Unit,
  type ProfileRoleRow,
  type GradeLesson,
  type GradeOption,
  type PendingUnit,
  buildSectionSlugs,
  readPersistentCache,
  writePersistentCache,
  UNIT_TOPICS_CACHE_TTL_MS,
  unitTopicsCacheKey,
  buildTopicHref,
  buildTopicTestHref,
  buildTopicQuestionBankHref,
  buildTopicImageAlt,
  buildSectionImageAlt,
  KAZANIMLAR_CACHE_TTL_MS,
  kazanimlarCacheKey,
  SPECIAL_WEEK_META,
  STUDY_TIPS,
} from './dersHelpers';

interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: Outcome[];
    contents: Content[];
    units?: Unit[];
    // Üst hiyerarşi barındaki "Ders Değiştir" dropdown'u için — o sınıftaki tüm aktif
    // dersler (bkz. kullanıcının 2026-09-05 isteği: sayfadan çıkmadan hızlıca ders
    // değiştirebilme).
    gradeLessons?: GradeLesson[];
    // Hiyerarşi barındaki "Sınıf" dropdown'u için — tüm yayındaki sınıflar (bkz.
    // kullanıcının 2026-09-05 isteği: sınıf da ders/ünite gibi dropdown olsun).
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

export default function DersClient({ initialData, gradeId, lessonId, week }: DersClientProps) {
  const { user, supabase } = useAuth();
  const router = useRouter();

  const { gradeName, lessonName, unitName, gradeSlug, lessonSlug, unitSlug, gradeLessons = [], allGrades = [] } = initialData;

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
  const [activeSectionSlug, setActiveSectionSlug] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [kazanimlarOpen, setKazanimlarOpen] = useState(false);
  // kazanimlarWeek "takvim haftası"dır (week prop'u öğretim haftasıdır) — bkz. totalCalendarWeeks
  // yorumu. Modal ilk kez bugünün öğretim haftasını (week) gösterecek şekilde açılsın diye
  // takvim haftasına çevrilerek başlatılır.
  const [kazanimlarWeek, setKazanimlarWeek] = useState(() => teachingWeekToCalendarWeek(week, initialData.termStartDate, initialData.breaks || []));
  const [allKazanimlar, setAllKazanimlar] = useState<WeekedOutcome[] | null>(null);
  const [specialWeeks, setSpecialWeeks] = useState<SpecialWeekEvent[] | null>(null);
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | number | null>(null);
  const [outcomeEditForm, setOutcomeEditForm] = useState<{ description: string; startWeek: string; endWeek: string }>({ description: '', startWeek: '', endWeek: '' });
  const [savingOutcomeEdit, setSavingOutcomeEdit] = useState(false);
  const [outcomeEditError, setOutcomeEditError] = useState<string | null>(null);
  const [topicQuestionCounts, setTopicQuestionCounts] = useState<Record<string, number> | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [heroImageZoomed, setHeroImageZoomed] = useState(false);
  const [topicSwitcherOpen, setTopicSwitcherOpen] = useState(false);
  const [lessonSwitcherOpen, setLessonSwitcherOpen] = useState(false);
  const [unitSwitcherOpen, setUnitSwitcherOpen] = useState(false);
  const [gradeSwitcherOpen, setGradeSwitcherOpen] = useState(false);
  // Hiyerarşi barı bir zincir: Sınıf -> Ders -> Ünite -> Konu. Bir üst seviye değiştikçe
  // ALT seviye(ler) "seçilmemiş" (null) durumuna döner ve pill'de "Ders/Ünite/Konu seçin"
  // placeholder'ı görünür — kullanıcı zincirin sonuna (Konu) kadar gelip gerçekten bir konu
  // seçmeden sayfa/içerik DEĞİŞMEZ (bkz. kullanıcının 2026-09-05 isteği). Hiçbir şey
  // değiştirilmeden (sayfa ilk açıldığında) bu zincir committed (URL'deki) sınıf/ders/
  // ünite/konuyla TAM eşleşir; placeholder'lar sadece bir dropdown'dan YENİ bir seçim
  // yapıldıktan SONRA, henüz alt seviye seçilmeden görünür.
  const [pendingGradeId, setPendingGradeId] = useState<number>(() => Number(gradeId));
  const [pendingGradeName, setPendingGradeName] = useState(gradeName);
  const [pendingGradeSlug, setPendingGradeSlug] = useState(gradeSlug);
  const [pendingLessons, setPendingLessons] = useState<GradeLesson[]>(gradeLessons);
  const [pendingLessonId, setPendingLessonId] = useState<number | null>(() => Number(lessonId));
  const [pendingLessonName, setPendingLessonName] = useState(lessonName);
  const [pendingLessonSlug, setPendingLessonSlug] = useState(lessonSlug);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [questionStatusByTopic, setQuestionStatusByTopic] = useState<Record<string, { general: boolean; sectionIds: number[] }>>({});
  const [topicMenuOpenId, setTopicMenuOpenId] = useState<string | number | null>(null);
  const [expandedTopicIds, setExpandedTopicIds] = useState<Set<string>>(new Set());
  const [manualUnitId, setManualUnitId] = useState<number | null>(null);
  const [expandedUnitIds, setExpandedUnitIds] = useState<Set<string>>(new Set());
  const [unitTopicsCache, setUnitTopicsCache] = useState<Record<string, Content[]>>({});
  const [loadingUnitIds, setLoadingUnitIds] = useState<Set<string>>(new Set());
  const [managingTopicId, setManagingTopicId] = useState<number | null>(null);
  const [planModalTopicId, setPlanModalTopicId] = useState<number | null>(null);
  const [notebookPlanTopicId, setNotebookPlanTopicId] = useState<number | null>(null);
  const [coverImageModalTopicId, setCoverImageModalTopicId] = useState<number | null>(null);
  const [topicHighlightsModalTopicId, setTopicHighlightsModalTopicId] = useState<number | null>(null);
  const [topicQuestionsModalTopic, setTopicQuestionsModalTopic] = useState<{ id: number; title: string; variant?: 'general' | 'notebooklm' | 'classical' | 'classical_notebooklm' } | null>(null);
  const [highlightQuickAddTopicId, setHighlightQuickAddTopicId] = useState<number | null>(null);
  const [highlightEditTarget, setHighlightEditTarget] = useState<{ topicId: number; index: number } | null>(null);
  const [sectionModalTarget, setSectionModalTarget] = useState<{ topicId: number; section: SectionModalSection; variant?: 'general' | 'notebooklm' } | null>(null);
  const [sectionMenuOpenId, setSectionMenuOpenId] = useState<string | number | null>(null);
  const [contentSectionMenuOpenId, setContentSectionMenuOpenId] = useState<string | number | null>(null);
  const [questionsModalTarget, setQuestionsModalTarget] = useState<{ topicId: number; section: { id: number; heading: string }; variant?: 'general' | 'notebooklm' | 'classical' | 'classical_notebooklm' } | null>(null);
  const [classicalGenerateTarget, setClassicalGenerateTarget] = useState<{ topicId: number; topicTitle: string; section?: { id: number; heading: string } | null } | null>(null);
  const [imageModalTarget, setImageModalTarget] = useState<{ topicId: number; section: SectionModalSection } | null>(null);
  const [diagramModalTarget, setDiagramModalTarget] = useState<{ topicId: number; section: SectionModalSection } | null>(null);
  const [editingContentSection, setEditingContentSection] = useState<EditableSection | null>(null);
  const [loadingEditSectionId, setLoadingEditSectionId] = useState<string | number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Bir TOC tıklaması başka bir konuya geçiş gerektirdiğinde, o konunun içeriği
  // render edilene kadar hangi alt başlığa kaydırılacağını burada bekletiyoruz.
  const pendingScrollSlugRef = useRef<string | null>(null);
  const initialHashHandledRef = useRef(false);

  const selectedTopicIndex = useMemo(() => {
    const idx = contents.findIndex((c) => String(c.id) === String(activeTopicId));
    return idx >= 0 ? idx : 0;
  }, [contents, activeTopicId]);

  const selectedTopicId = contents[selectedTopicIndex]?.id ?? null;
  const activeTopic = contents[selectedTopicIndex];

  const activeTopicSectionSlugs = useMemo(
    () => buildSectionSlugs(activeTopic?.sections || []),
    [activeTopic]
  );

  // Math.random() render sırasında değil (sunucu/istemci hidrasyon uyuşmazlığı
  // yaratmasın diye) bir effect içinde çağrılır; ilk gösterim konu index'ine göre
  // sabit bir ipucuyla başlar, hidrasyondan hemen sonra rastgele biriyle değiştirilir.
  const [studyTip, setStudyTip] = useState(() => STUDY_TIPS[selectedTopicIndex % STUDY_TIPS.length]);
  useEffect(() => {
    setStudyTip(STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)]);
  }, [selectedTopicId]);

  // Akordeon: sadece seçili konunun alt başlıkları açık kalsın, diğer konularınki kapansın
  useEffect(() => {
    if (selectedTopicId == null) return;
    setExpandedTopicIds(new Set([String(selectedTopicId)]));
  }, [selectedTopicId]);

  // Konu değişince Konu dropdown'u her seferinde kapalı başlasın — bir önceki
  // konunun açık bıraktığı durumla kafa karıştırmasın.
  useEffect(() => {
    setTopicSwitcherOpen(false);
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

  useEffect(() => {
    if (!heroImageZoomed) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeroImageZoomed(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [heroImageZoomed]);

  // Sadece aktif ünitenin değil, sidebar'da "İçindekiler" ağacında o an görünen
  // (arkaplanda önceden ısıtılmış) tüm ünitelerin konularını kapsar — yoksa başka
  // bir ünitedeki konuya daha önce eklenmiş soruların tiki hiç görünmez.
  const allVisibleTopicIdsKey = useMemo(() => {
    const ids = new Set<string>();
    contents.forEach((c) => ids.add(String(c.id)));
    Object.values(unitTopicsCache).forEach((topics) => topics.forEach((c) => ids.add(String(c.id))));
    return Array.from(ids).join(',');
  }, [contents, unitTopicsCache]);

  const loadQuestionStatus = useCallback(async () => {
    if (!isAdmin || !allVisibleTopicIdsKey) return;
    const res = await fetch(`/api/admin/topic-sections/question-status?topicIds=${allVisibleTopicIdsKey}`);
    if (res.ok) {
      const data = await res.json();
      setQuestionStatusByTopic(data?.byTopic || {});
    }
  }, [isAdmin, allVisibleTopicIdsKey]);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin || !allVisibleTopicIdsKey) {
      setQuestionStatusByTopic({});
      return;
    }
    fetch(`/api/admin/topic-sections/question-status?topicIds=${allVisibleTopicIdsKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { byTopic?: Record<string, { general: boolean; sectionIds: number[] }> } | null) => {
        if (!cancelled) setQuestionStatusByTopic(data?.byTopic || {});
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, allVisibleTopicIdsKey]);

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
  const activeUnitSlug = activeUnit?.slug || unitSlug || null;

  // Ünite/Konu zincirinin geri kalanı — bkz. dosyanın başındaki pendingGradeId/pendingLessonId
  // yorumu. null = "seçilmemiş, kullanıcı seçene kadar placeholder göster" (sadece bir üst
  // seviye YENİ bir değere değiştirildiğinde bu null'a döner); ilk yüklemede committed
  // ünite/ilk konuyla eşleşir, placeholder değildir.
  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>(sortedUnits);
  const [pendingUnitId, setPendingUnitId] = useState<number | null>(() => (activeUnit?.id != null ? Number(activeUnit.id) : null));
  const [pendingUnitName, setPendingUnitName] = useState(unitTitle);
  const [pendingUnitSlug, setPendingUnitSlug] = useState<string | null>(activeUnitSlug);
  // null = "commit edilmiş ünitedeki (contents) konularla aynı" — Konu dropdown'u doğrudan
  // contents'i gösterir; dolu bir dizi ise farklı bir üniteye ait, henüz commit edilmemiş
  // bir konu listesidir.
  const [pendingTopics, setPendingTopics] = useState<Content[] | null>(null);
  // Konu dropdown'unun gösterdiği liste: ünite henüz seçilmediyse (sınıf/ders değişip
  // zincir sıfırlandıysa) boş — "önce ünite seçin"; seçildiyse o ünitenin konuları
  // (pendingTopics'ten, henüz commit edilmemişse) veya doğrudan bu sayfanın kendi konuları.
  const konuDropdownOptions: Content[] = pendingUnitId == null ? [] : (pendingTopics ?? contents);
  // Zincirin tamamı (sınıf/ders/ünite) committed sayfayla TAM eşleşiyor mu? Eşleşmiyorsa Konu
  // pill'i gerçek activeTopic yerine "Konu seçin" placeholder'ı gösterir (bkz. handleUnitDropdownSelect).
  const isChainFullyResolved =
    pendingGradeId === Number(gradeId) &&
    pendingLessonId === Number(lessonId) &&
    pendingUnitId != null &&
    activeUnit?.id != null &&
    pendingUnitId === Number(activeUnit.id);

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

  // Sunucu artık ilk yüklemede SADECE açılan konunun tam içeriğini gönderiyor (bkz.
  // getLessonWeekData'daki activeTopic parametresi); ünitedeki diğer konular başlık/slug
  // ile hafif geliyor (contentLoaded:false). Kullanıcı sidebar'dan o konuya geçtiğinde veya
  // ileri/geri ile ona yaklaştığında bu, tek bir konunun içeriğini arkaplanda/isteğe bağlı çeker.
  const inFlightTopicContentFetchesRef = useRef<Record<string, Promise<void> | undefined>>({});

  const ensureTopicContentLoaded = useCallback((topic: Content, unit: Unit): Promise<void> => {
    if (topic.contentLoaded) return Promise.resolve();
    const key = String(topic.id);
    if (inFlightTopicContentFetchesRef.current[key]) return inFlightTopicContentFetchesRef.current[key]!;

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams({
          gradeId,
          lessonId,
          unitId: String(unit.id),
          week: String(unit.start_week || week),
          topicId: key,
        });
        const response = await fetch(`/api/lesson-week-data?${params.toString()}`);
        if (!response.ok) return;
        const data = await response.json() as { contents?: Content[] };
        const loaded = data.contents?.find((c) => String(c.id) === key);
        if (!loaded?.contentLoaded) return;

        const mergeLoaded = (list: Content[]) => list.map((c) => (String(c.id) === key ? { ...c, ...loaded } : c));
        setContents((prev) => mergeLoaded(prev));
        setUnitTopicsCache((prev) => (prev[String(unit.id)] ? { ...prev, [String(unit.id)]: mergeLoaded(prev[String(unit.id)]) } : prev));
      } catch (error) {
        console.error('Konu içeriği yüklenemedi:', error);
      } finally {
        delete inFlightTopicContentFetchesRef.current[key];
      }
    })();

    inFlightTopicContentFetchesRef.current[key] = fetchPromise;
    return fetchPromise;
  }, [gradeId, lessonId, week]);

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
    }
    setManualUnitId(Number(unit.id));
  };

  async function fetchLessonsForGrade(gId: number): Promise<GradeLesson[]> {
    try {
      const res = await fetch(`/api/grade-lessons?gradeId=${gId}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { lessons?: GradeLesson[] };
      return data.lessons || [];
    } catch {
      return [];
    }
  }

  async function fetchUnitsForLesson(gId: number, lId: number): Promise<PendingUnit[]> {
    try {
      const res = await fetch(`/api/lesson-units?gradeId=${gId}&lessonId=${lId}&publicOnly=1`);
      if (!res.ok) return [];
      const data = (await res.json()) as {
        units?: { id: number; title: string; slug: string | null; orderNo: number; isActive: boolean; firstTopicSlug: string | null }[];
      };
      return (data.units || []).map((u) => ({
        id: u.id,
        title: u.title,
        slug: u.slug,
        order_no: u.orderNo,
        start_week: null,
        end_week: null,
        is_active: u.isActive,
        firstTopicSlug: u.firstTopicSlug,
      }));
    } catch {
      return [];
    }
  }

  // /api/lesson-week-data gradeId/lessonId'yi kullanmaz (sadece unitId+week) — bu yüzden
  // HERHANGİ bir ünitenin konu listesini (henüz commit edilmemiş, sadece dropdown'da
  // önizlenen bir ünite dahil) çekmek için güvenle kullanılabilir.
  async function fetchTopicsForUnit(unit: PendingUnit): Promise<Content[]> {
    try {
      const params = new URLSearchParams({
        gradeId: String(pendingGradeId),
        lessonId: String(pendingLessonId ?? ''),
        unitId: String(unit.id),
        week: String(unit.start_week || week),
        publicOnly: '1',
      });
      const res = await fetch(`/api/lesson-week-data?${params.toString()}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { contents?: Content[] };
      return data.contents || [];
    } catch {
      return [];
    }
  }

  // Sınıf SONRA ders seçimi art arda hızlıca yapılırsa, sınıf seçiminin tetiklediği ünite
  // fetch'i, ders seçiminin tetiklediği (daha yeni) fetch'ten SONRA dönebilir — bu da eski
  // (yanlış derse ait) verileri sessizce ezerdi (kullanıcı gözlemledi: Ders etiketi doğru
  // dersi gösterirken Ünite listesi/commit linki hâlâ ESKİ derse aitti). Her pending-
  // değiştiren aksiyon kendi "nesil" numarasını alır; bir fetch dönene kadar daha YENİ bir
  // aksiyon başlamışsa (nesil ilerlemişse) sonucu sessizce atılır.
  const pendingRequestIdRef = useRef(0);

  // Sınıf dropdown'unda bir sınıfa tıklanınca: sayfa/içerik DEĞİŞMEZ. O sınıftaki dersler
  // çekilip Ders dropdown'u doldurulur; Ders/Ünite/Konu zinciri "seçilmemiş" durumuna
  // döner ("Ders seçin" placeholder'ı görünür) — kullanıcının 2026-09-05 isteği: her üst
  // seviye değişikliği alt seviyeleri sıfırlar, otomatik ders/ünite/konu tahmini yapılmaz.
  const handleGradeDropdownSelect = async (grade: GradeOption) => {
    setGradeSwitcherOpen(false);
    if (grade.id === pendingGradeId) return;
    const requestId = ++pendingRequestIdRef.current;

    setPendingGradeId(grade.id);
    setPendingGradeName(grade.name);
    setPendingGradeSlug(grade.slug);
    setPendingLessonId(null);
    setPendingLessonName('');
    setPendingLessonSlug(null);
    setPendingUnits([]);
    setPendingUnitId(null);
    setPendingUnitName('');
    setPendingUnitSlug(null);
    setPendingTopics(null);
    setPendingLoading(true);
    try {
      const lessons = grade.id === Number(gradeId) ? gradeLessons : await fetchLessonsForGrade(grade.id);
      if (pendingRequestIdRef.current !== requestId) return;
      setPendingLessons(lessons);
    } finally {
      if (pendingRequestIdRef.current === requestId) setPendingLoading(false);
    }
  };

  // Ders dropdown'unda bir derse tıklanınca: aynı mantık — sayfa/içerik değişmez, sadece o
  // dersin üniteleri Ünite dropdown'una çekilir; Ünite/Konu "seçilmemiş" durumuna döner.
  const handleLessonDropdownSelect = async (lesson: GradeLesson) => {
    setLessonSwitcherOpen(false);
    if (lesson.id === pendingLessonId) return;
    const requestId = ++pendingRequestIdRef.current;

    setPendingLessonId(lesson.id);
    setPendingLessonName(lesson.name);
    setPendingLessonSlug(lesson.slug);
    setPendingUnits([]);
    setPendingUnitId(null);
    setPendingUnitName('');
    setPendingUnitSlug(null);
    setPendingTopics(null);
    setPendingLoading(true);
    try {
      const nextUnits = await fetchUnitsForLesson(pendingGradeId, lesson.id);
      if (pendingRequestIdRef.current !== requestId) return;
      setPendingUnits(nextUnits);
    } finally {
      if (pendingRequestIdRef.current === requestId) setPendingLoading(false);
    }
  };

  // Ünite dropdown'unda bir üniteye tıklanınca: hâlâ sayfa/içerik DEĞİŞMEZ, sadece o
  // ünitenin konuları çekilip Konu dropdown'u doldurulur ("Konu seçin" placeholder'ı
  // görünür). Asıl commit (sayfa/içerik yenileme) artık Konu seçildiğinde olur.
  const handleUnitDropdownSelect = async (unit: PendingUnit) => {
    setUnitSwitcherOpen(false);
    if (unit.id === pendingUnitId) return;
    const requestId = ++pendingRequestIdRef.current;

    setPendingUnitId(unit.id);
    setPendingUnitName(unit.title);
    setPendingUnitSlug(unit.slug);
    setPendingTopics(null);
    setPendingLoading(true);
    try {
      const sameAsCommitted = pendingGradeId === Number(gradeId) && pendingLessonId === Number(lessonId) && Number(unit.id) === Number(activeUnit?.id);
      const nextTopics = sameAsCommitted ? contents : await fetchTopicsForUnit(unit);
      if (pendingRequestIdRef.current !== requestId) return;
      setPendingTopics(sameAsCommitted ? null : nextTopics);
    } finally {
      if (pendingRequestIdRef.current === requestId) setPendingLoading(false);
    }
  };

  // Konu dropdown'unda bir konuya tıklanınca: BU seçim commit'tir. Sınıf/ders/ünite hâlâ
  // mevcut sayfayla aynıysa (yani kullanıcı sadece aynı ünite içinde konu değiştirdi)
  // mevcut navigasyonsuz anlık geçiş kullanılır. Ünite farklıysa (ama sınıf/ders aynıysa)
  // az önce çekilmiş konu listesi doğrudan client'ta içerik olarak basılır — yine
  // navigasyonsuz. Sınıf ve/veya ders de değiştiyse gerçek bir sayfa geçişi yapılır (o
  // derste units/outcomes/kazanımlar gibi hemen hemen HER state farklı olduğu için
  // bunları client'ta manuel senkronize etmek yerine sunucudan taze bir sayfa istemek
  // çok daha güvenli, bkz. dosyanın başındaki geçmiş bug yorumları).
  const handleTopicDropdownSelect = (topic: Content) => {
    setTopicSwitcherOpen(false);
    const sameLessonAsCommitted = pendingGradeId === Number(gradeId) && pendingLessonId === Number(lessonId);

    if (sameLessonAsCommitted) {
      const sameUnitAsCommitted = pendingUnitId != null && Number(pendingUnitId) === Number(activeUnit?.id);
      if (sameUnitAsCommitted) {
        const idx = contents.findIndex((c) => String(c.id) === String(topic.id));
        if (idx >= 0) goToTopic(idx);
      } else if (pendingUnitId != null) {
        const topics = pendingTopics ?? [];
        setContents(topics);
        setActiveTopicId(topic.id);
        setManualUnitId(Number(pendingUnitId));
        setUnitTopicsCache((prev) => ({ ...prev, [String(pendingUnitId)]: topics }));
      }
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!pendingGradeSlug || !pendingLessonSlug || !pendingUnitSlug || !topic.slug) return;
    router.push(`/${pendingGradeSlug}/${pendingLessonSlug}/${pendingUnitSlug}/${topic.slug}`);
  };

  const selectUnitTopic = (unit: Unit, topicId: string | number) => {
    let list = contents;
    if (String(unit.id) !== String(activeUnit?.id)) {
      const cached = unitTopicsCache[String(unit.id)];
      if (cached) {
        list = cached;
        setContents(cached);
      }
      setManualUnitId(Number(unit.id));
    }
    setActiveTopicId(topicId);
    setSidebarOpen(false);
    const topic = list.find((c) => String(c.id) === String(topicId));
    if (topic) void ensureTopicContentLoaded(topic, unit);
  };

  // Aktif olarak gösterilen konudaki bir alt başlığa (section) kayar; artık her
  // alt başlık aynı sayfada birlikte render edildiği için "seçim" değil, sadece
  // o başlığa scroll + adres çubuğunu (#slug) güncellemek anlamına geliyor.
  const goToSectionAnchor = (slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (gradeSlug && lessonSlug && activeUnit?.slug && activeTopic?.slug) {
        const url = `/${gradeSlug}/${lessonSlug}/${activeUnit.slug}/${activeTopic.slug}#${slug}`;
        window.history.replaceState(null, '', url);
      }
    }
    setSidebarOpen(false);
  };

  // Başka bir konudaki/üniteredeki bir alt başlığa tıklanınca: önce o konuyu aktif
  // yapar, içerik render olduktan sonra pendingScrollSlugRef üzerinden anchor'a kayar.
  const selectUnitSection = (unit: Unit, topicId: string | number, slug: string) => {
    let list = contents;
    if (String(unit.id) !== String(activeUnit?.id)) {
      const cached = unitTopicsCache[String(unit.id)];
      if (cached) {
        list = cached;
        setContents(cached);
      }
      setManualUnitId(Number(unit.id));
    }
    setActiveTopicId(topicId);
    pendingScrollSlugRef.current = slug;
    setSidebarOpen(false);
    const topic = list.find((c) => String(c.id) === String(topicId));
    if (topic) void ensureTopicContentLoaded(topic, unit);
  };

  const totalTopics = contents.length;
  const totalWeeks = initialData.totalWeeks || 38;

  // Bu ders+sınıf için geçerli özel haftalardan (tatil/özel içerik/sosyal etkinlik — ör.
  // "Sosyal Etkinlik Haftası" tüm derslere tek kayıtla uygulanıyor) en geç tarihlisinin
  // hangi takvim haftasına denk geldiğini bulur. Bu ders kendi ünitelerini daha erken
  // bitirse bile modal navigasyonu bu haftaya kadar açık kalmalı — aksi halde derse özel
  // olmayan (grade_ids/lesson_id boş) genel bir özel hafta, içeriği erken biten bir dersin
  // modalinde asla ulaşılamaz kalır.
  const maxSpecialWeekCalendarWeek = useMemo(() => {
    if (!specialWeeks?.length) return 0;
    return specialWeeks.reduce((max, sw) => {
      if (!sw.endDate) return max;
      const cw = getCurriculumWeekFromDate(sw.endDate, 60, initialData.termStartDate);
      return cw != null ? Math.max(max, cw) : max;
    }, 0);
  }, [specialWeeks, initialData.termStartDate]);

  // Kazanımlar modali "takvim haftası" (okulun açılışından itibaren gerçek, atlamasız hafta
  // sayısı — tatil haftaları da dahil sayılır) üzerinden gezinir; sitenin geri kalanı
  // (aktif ünite/konu seçimi, URL) öğretim haftası (outcome_weeks'teki hafta) üzerinden
  // çalışmaya devam eder. Admin /admin/takvim'de okul bitiş tarihini girdiyse modalin üst
  // sınırı doğrudan başlangıç-bitiş arasındaki gerçek takvim haftası sayısından hesaplanır
  // (en güvenilir kaynak); girilmemişse eskisi gibi ünitelerin/özel haftaların nereye kadar
  // uzandığından dolaylı tahmin edilir.
  const totalCalendarWeeks = useMemo(() => {
    const fromTermDates = calendarWeeksBetween(initialData.termStartDate, initialData.termEndDate);
    if (fromTermDates != null) return fromTermDates;
    const unitBased = teachingWeekToCalendarWeek(totalWeeks, initialData.termStartDate, initialData.breaks || []);
    return Math.max(unitBased, maxSpecialWeekCalendarWeek);
  }, [totalWeeks, initialData.termStartDate, initialData.termEndDate, initialData.breaks, maxSpecialWeekCalendarWeek]);

  const unitStartWeek = activeUnit?.start_week || 1;
  const unitEndWeek = activeUnit?.end_week || totalWeeks;
  const curriculumWeekRangeLabel = unitStartWeek === unitEndWeek ? `${unitStartWeek}. Hafta` : `${unitStartWeek}–${unitEndWeek}. Hafta`;
  const curriculumDateRangeLabel = useMemo(
    () => formatWeekDateRangeLabel(unitStartWeek, unitEndWeek, totalWeeks, initialData.termStartDate, initialData.breaks || []),
    [unitStartWeek, unitEndWeek, totalWeeks, initialData.termStartDate, initialData.breaks]
  );

  // Kazanımlar modalinde gösterilen haftanın (kazanimlarWeek, takvim haftası) tarih
  // aralığı — kazanimlarWeek zaten takvim haftası olduğu için breaks'e gerek yok, düz
  // (termStart'tan +7'şer günlük) hesap yeterli.
  const kazanimlarWeekDateLabel = useMemo(
    () => formatWeekDateRangeLabel(kazanimlarWeek, kazanimlarWeek, totalCalendarWeeks, initialData.termStartDate),
    [kazanimlarWeek, totalCalendarWeeks, initialData.termStartDate]
  );

  // Sağ sidebar'daki "Ünite Özeti" kartı için: aktif ünitenin konuları + arka planda
  // önceden çekilmiş soru sayıları (topicQuestionCounts) birleştirilir. Sayılar henüz
  // gelmediyse (ilk 1-2sn) kart hiç gösterilmez.
  const unitQuestionSummary = useMemo(() => {
    if (!topicQuestionCounts) return null;
    const topics = contents.map((topic) => ({
      id: topic.id,
      title: topic.title,
      count: topicQuestionCounts[String(topic.id)] ?? 0,
    }));
    const total = topics.reduce((sum, t) => sum + t.count, 0);
    return { topics, total };
  }, [contents, topicQuestionCounts]);

  const openKazanimlarModal = () => {
    setKazanimlarWeek(teachingWeekToCalendarWeek(week, initialData.termStartDate, initialData.breaks || []));
    setKazanimlarOpen(true);
  };

  const goToKazanimlarWeek = (targetWeek: number) => {
    if (targetWeek < 1 || targetWeek > totalCalendarWeeks) return;
    setKazanimlarWeek(targetWeek);
  };

  // Aynı anda birden fazla yerden (arkaplan ısıtma + modal açılışı) eş zamanlı istenirse
  // mükerrer fetch'i önlemek için tek uçuşluk (single-flight) referans
  const inFlightAllKazanimlarFetchRef = useRef<Promise<WeekedOutcome[]> | null>(null);

  // Bu dersin (gradeId+lessonId) TÜM haftalarına ait kazanımlarını TEK istekte yükler;
  // bellek içi state, sonra localStorage (10 gün), sonra ağ sırasıyla denenir. Kazanımlar
  // modali daha sonra bu tek listeyi haftaya göre kendi içinde (ücretsizce) filtreler —
  // her hafta için ayrı ayrı ağır /api/lesson-week-data çağrısı yapmaya gerek kalmaz.
  const ensureAllKazanimlarLoaded = useCallback((): Promise<WeekedOutcome[]> => {
    if (allKazanimlar) return Promise.resolve(allKazanimlar);

    // localStorage önbelleği (10 gün) şimdilik devre dışı — yıllık plan aracıyla
    // kazanımlar aktif olarak eklenip test edildiği için eski önbellek yeni
    // eklenenleri günlerce gizleyebiliyordu. Bellek içi state + single-flight
    // dedup zaten aynı sayfa oturumu içinde tekrar isteği önlüyor.
    // TODO: kazanımlar stabilize olunca readPersistentCache/writePersistentCache'i geri aç.

    if (inFlightAllKazanimlarFetchRef.current) {
      return inFlightAllKazanimlarFetchRef.current;
    }

    const fetchPromise = (async (): Promise<WeekedOutcome[]> => {
      try {
        const params = new URLSearchParams({ gradeId, lessonId });
        const response = await fetch(`/api/lesson-outcomes?${params.toString()}`);
        const data = response.ok ? await response.json() as { outcomes?: WeekedOutcome[] } : null;
        const outcomes = data?.outcomes || [];
        setAllKazanimlar(outcomes);
        return outcomes;
      } catch {
        setAllKazanimlar([]);
        return [];
      } finally {
        inFlightAllKazanimlarFetchRef.current = null;
      }
    })();

    inFlightAllKazanimlarFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [allKazanimlar, gradeId, lessonId]);

  useEffect(() => {
    if (!kazanimlarOpen) return;
    ensureAllKazanimlarLoaded();
  }, [kazanimlarOpen, ensureAllKazanimlarLoaded]);

  // Modal kapanınca veya haftalar arası gezinilince açık kalan düzenleme formu kapansın
  useEffect(() => {
    setEditingOutcomeId(null);
  }, [kazanimlarOpen, kazanimlarWeek]);

  // Kazanım düzenleme kaydedildikten sonra allKazanimlar'ı tazelemek için — ensureAllKazanimlarLoaded
  // bellekteki listeyi cache'lediğinden onu değil, doğrudan ağdan tazesini çeken bu fonksiyonu kullanır.
  const refetchAllKazanimlar = useCallback(async () => {
    try {
      const params = new URLSearchParams({ gradeId, lessonId });
      const response = await fetch(`/api/lesson-outcomes?${params.toString()}`);
      const data = response.ok ? await response.json() as { outcomes?: WeekedOutcome[] } : null;
      setAllKazanimlar(data?.outcomes || []);
    } catch {
      // sessizce yoksay — ekranda eski liste kalır, kullanıcı isterse modalı kapatıp açar
    }
  }, [gradeId, lessonId]);

  function openOutcomeEdit(o: WeekedOutcome) {
    setEditingOutcomeId(o.id ?? null);
    setOutcomeEditForm({
      description: o.description,
      startWeek: o.startWeek != null ? String(o.startWeek) : '',
      endWeek: o.endWeek != null ? String(o.endWeek) : '',
    });
    setOutcomeEditError(null);
  }

  function cancelOutcomeEdit() {
    setEditingOutcomeId(null);
    setOutcomeEditError(null);
  }

  // Kazanımın metnini (outcomes.description) ve/veya hangi öğretim haftasında işlendiğini
  // (outcome_weeks) tek seferde kaydeder — ikisi ayrı tablo/endpoint olduğu için gerekiyorsa
  // paralel iki istek atılır.
  async function saveOutcomeEdit() {
    if (editingOutcomeId == null) return;
    const outcomeId = Number(editingOutcomeId);
    const description = outcomeEditForm.description.trim();
    const startWeek = Number(outcomeEditForm.startWeek);
    const endWeek = Number(outcomeEditForm.endWeek);

    if (!description) {
      setOutcomeEditError('Kazanım metni boş olamaz');
      return;
    }
    if (!Number.isFinite(startWeek) || startWeek < 1 || startWeek > 52) {
      setOutcomeEditError('Başlangıç haftası 1-52 arasında olmalı');
      return;
    }
    if (!Number.isFinite(endWeek) || endWeek < startWeek || endWeek > 52) {
      setOutcomeEditError('Bitiş haftası başlangıçtan küçük olamaz');
      return;
    }

    setSavingOutcomeEdit(true);
    setOutcomeEditError(null);
    try {
      const [descRes, weekRes] = await Promise.all([
        fetch('/api/admin/manage/outcomes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [outcomeId], patch: { description } }),
        }),
        fetch('/api/admin/manage/outcome-weeks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcomeId, startWeek, endWeek }),
        }),
      ]);
      if (!descRes.ok || !weekRes.ok) {
        const errData = !descRes.ok ? await descRes.json().catch(() => null) : await weekRes.json().catch(() => null);
        setOutcomeEditError(errData?.error || 'Kaydedilemedi');
        return;
      }
      setEditingOutcomeId(null);
      await refetchAllKazanimlar();
    } catch {
      setOutcomeEditError('Kaydedilirken hata oluştu (ağ hatası)');
    } finally {
      setSavingOutcomeEdit(false);
    }
  }

  // Kazanımlar modali açıldığında, bu sınıf+ders için geçerli özel haftaları (tatil/özel
  // içerik/sosyal etkinlik) da tek seferde çeker — modal her hafta için ayrıca istek atmaz,
  // liste zaten tarihiyle geldiği için haftaya göre kendi içinde filtrelenir.
  const inFlightSpecialWeeksFetchRef = useRef<Promise<SpecialWeekEvent[]> | null>(null);
  const ensureSpecialWeeksLoaded = useCallback((): Promise<SpecialWeekEvent[]> => {
    if (specialWeeks) return Promise.resolve(specialWeeks);
    if (inFlightSpecialWeeksFetchRef.current) return inFlightSpecialWeeksFetchRef.current;

    const fetchPromise = (async (): Promise<SpecialWeekEvent[]> => {
      try {
        const params = new URLSearchParams({ gradeId, lessonId });
        const response = await fetch(`/api/curriculum-special-weeks?${params.toString()}`);
        const data = response.ok ? await response.json() as { items?: SpecialWeekEvent[] } : null;
        const items = data?.items || [];
        setSpecialWeeks(items);
        return items;
      } catch {
        setSpecialWeeks([]);
        return [];
      } finally {
        inFlightSpecialWeeksFetchRef.current = null;
      }
    })();

    inFlightSpecialWeeksFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [specialWeeks, gradeId, lessonId]);

  useEffect(() => {
    if (!kazanimlarOpen) return;
    ensureSpecialWeeksLoaded();
  }, [kazanimlarOpen, ensureSpecialWeeksLoaded]);

  useEffect(() => {
    setSpecialWeeks(null);
  }, [gradeId, lessonId]);

  // Sayfa açıldıktan 5 saniye sonra (kullanıcı "Kazanımlar"a hiç tıklamamış olsa bile),
  // bu dersin tüm haftalarına ait kazanımlarını arkaplanda sessizce ısıtır — böylece butona
  // tıklanıp herhangi bir haftaya geçildiğinde hep anında açılır. 5sn gecikme, ilk sayfa
  // yüklemesiyle çakışıp ağı boğmasın diyedir.
  const hasStartedKazanimlarPrefetchRef = useRef(false);
  useEffect(() => {
    if (isWeekDataLoading) return;
    if (hasStartedKazanimlarPrefetchRef.current) return;
    if (!units.length) return;
    hasStartedKazanimlarPrefetchRef.current = true;

    const timeoutId = window.setTimeout(() => {
      ensureAllKazanimlarLoaded();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [isWeekDataLoading, units.length, ensureAllKazanimlarLoaded]);

  // Sağ sidebar'daki "Ünite Özeti" kartı için: bu dersin (gradeId+lessonId) TÜM
  // ünitelerindeki TÜM konuların soru sayılarını tek istekte, sayfa açıldıktan 1.5sn
  // sonra arka planda çeker. Bu veri sadece istemci tarafında (useEffect içinde)
  // çekildiği için SEO'yu etkilemez ve ilk sayfa render'ını yavaşlatmaz.
  const hasStartedQuestionCountsPrefetchRef = useRef(false);
  useEffect(() => {
    hasStartedQuestionCountsPrefetchRef.current = false;
    setTopicQuestionCounts(null);
  }, [gradeId, lessonId]);

  useEffect(() => {
    if (isWeekDataLoading) return;
    if (hasStartedQuestionCountsPrefetchRef.current) return;
    hasStartedQuestionCountsPrefetchRef.current = true;

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({ gradeId, lessonId });
      fetch(`/api/lesson-topic-question-counts?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { byTopic?: Record<string, number> } | null) => {
          if (data?.byTopic) setTopicQuestionCounts(data.byTopic);
        })
        .catch(() => {});
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [isWeekDataLoading, gradeId, lessonId]);

  // kazanimlarWeek bir takvim haftası; kazanımlar ise outcome_weeks'teki öğretim haftası
  // numarasıyla saklı — önce takvim haftasının hangi öğretim haftasına denk geldiğini buluyoruz
  // (tatile denk geliyorsa null: o hafta hiç kazanım yok, sadece tatil kartı gösterilir).
  const kazanimlarTeachingWeek = useMemo(
    () => resolveTeachingWeek(kazanimlarWeek, initialData.termStartDate, initialData.breaks || []),
    [kazanimlarWeek, initialData.termStartDate, initialData.breaks]
  );

  // Kazanımlar modalinde gösterilecek liste: tek seferde çekilen tüm kazanımlardan,
  // seçili takvim haftasının denk geldiği öğretim haftasının aralığına (start_week–end_week)
  // düşenler — ağ isteği gerektirmez.
  const kazanimlarForSelectedWeek = useMemo(() => {
    if (!allKazanimlar) return null;
    if (kazanimlarTeachingWeek == null) return [];
    return allKazanimlar.filter(
      (o) => o.startWeek != null && o.endWeek != null && kazanimlarTeachingWeek >= o.startWeek && kazanimlarTeachingWeek <= o.endWeek
    );
  }, [allKazanimlar, kazanimlarTeachingWeek]);

  // Kazanımlar modalinde gösterilen takvim haftasıyla (Pazartesi-Cuma) tarih aralığı çakışan
  // özel haftaları (tatil/özel içerik/sosyal etkinlik) bulur — hepsi API'den gerçek tarihiyle
  // geldiği için hafta numarasına değil, doğrudan tarih çakışmasına bakılır. kazanimlarWeek
  // zaten takvim haftası olduğu için breaks'e (dolayısıyla öğretim haftası kaymasına) gerek yok.
  const specialWeeksForSelectedWeek = useMemo(() => {
    if (!specialWeeks) return null;
    const { start, end } = getWeekDateRange(kazanimlarWeek, totalCalendarWeeks, initialData.termStartDate);
    const weekStartIso = start.toISOString().slice(0, 10);
    const weekEndIso = end.toISOString().slice(0, 10);
    return specialWeeks.filter((sw) => sw.startDate && sw.endDate && sw.startDate <= weekEndIso && sw.endDate >= weekStartIso);
  }, [specialWeeks, kazanimlarWeek, totalCalendarWeeks, initialData.termStartDate]);

  // Sadece adminlere: seçili takvim haftası tatil değil ama ne kazanım ne de özel hafta
  // (tatil/özel içerik/sosyal etkinlik) bulunuyorsa — yıllık plan verisinde veya özel hafta
  // girişlerinde bir eksiklik olabileceğine işaret eder.
  const isAdminGapWeek =
    isAdmin &&
    kazanimlarTeachingWeek != null &&
    kazanimlarForSelectedWeek != null &&
    kazanimlarForSelectedWeek.length === 0 &&
    specialWeeksForSelectedWeek != null &&
    specialWeeksForSelectedWeek.length === 0;

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

  // Bir TOC tıklaması konu değişikliği gerektirdiyse (selectUnitSection), yeni
  // konunun alt başlıkları DOM'a yazıldıktan sonra bekleyen anchor'a kaydır.
  useEffect(() => {
    if (!pendingScrollSlugRef.current) return;
    const slug = pendingScrollSlugRef.current;
    pendingScrollSlugRef.current = null;
    requestAnimationFrame(() => {
      const el = document.getElementById(slug);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (gradeSlug && lessonSlug && activeUnit?.slug && activeTopic?.slug) {
          const url = `/${gradeSlug}/${lessonSlug}/${activeUnit.slug}/${activeTopic.slug}#${slug}`;
          window.history.replaceState(null, '', url);
        }
      }
    });
  }, [activeTopic?.id, gradeSlug, lessonSlug, activeUnit?.slug]);

  // Sayfa doğrudan bir #alt-başlık linkiyle açıldıysa (ör. arama sonucundan),
  // ilk içerik render olduktan sonra bir kere o başlığa kaydır.
  useEffect(() => {
    if (initialHashHandledRef.current) return;
    if (!activeTopic) return;
    initialHashHandledRef.current = true;
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (!hash) return;
    requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: 'start' });
    });
  }, [activeTopic]);

  // Uzun, tüm alt başlıkların art arda göründüğü sayfada kullanıcı kaydırdıkça
  // sol menüde hangi alt başlıkta olduğunu vurgulamak için basit bir scroll-spy.
  useEffect(() => {
    const sectionEls = Array.from(document.querySelectorAll('[data-section-anchor]')) as HTMLElement[];
    if (!sectionEls.length) {
      setActiveSectionSlug(null);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveSectionSlug(visible[0].target.getAttribute('data-section-anchor'));
        }
      },
      { root: contentRef.current, rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activeTopic?.id]);

  useEffect(() => {
    setUnits(initialData.units || []);
    setContents(initialData.contents);
    setOutcomes(initialData.outcomes);
    setActiveTopicId(pickInitialTopicId(initialData.contents, initialData.topicSlug));
    setIsWeekDataLoading(true);
    setManualUnitId(null);
    setKazanimlarWeek(teachingWeekToCalendarWeek(week, initialData.termStartDate, initialData.breaks || []));
  }, [initialData, week]);

  // allKazanimlar tüm ders (gradeId+lessonId) için tek seferde çekildiği için sadece
  // gerçekten farklı bir derse geçildiğinde sıfırlanmalı — aynı derste konu/ünite
  // değiştirmek onu geçersiz kılmaz, gereksiz yeniden yüklemeyi önler.
  useEffect(() => {
    setAllKazanimlar(null);
  }, [gradeId, lessonId]);

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

  // Ders sayfasında, okuduğu alt başlığın hemen altındaki "İçeriği Düzenle" butonuna
  // basınca ham markdown'ı çeker ve düzenleme penceresini açar.
  const openContentEditModal = async (sectionId: string | number) => {
    setLoadingEditSectionId(sectionId);
    try {
      const res = await fetch(`/api/admin/topic-sections/section/${sectionId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setEditingContentSection(data as EditableSection);
      }
    } finally {
      setLoadingEditSectionId(null);
    }
  };

  const goToTopic = (index: number) => {
    const topic = contents[index];
    if (!topic) return;
    setActiveTopicId(topic.id);
    if (activeUnit) void ensureTopicContentLoaded(topic, activeUnit);
  };

  // İleri/geri ile okuma akışı en sık kullanılan gezinme olduğu için, kullanıcı bir konuya
  // gerçekten ulaşmadan ÖNCE komşu (bir önceki/sonraki) konunun içeriğini arkaplanda ısıtır —
  // böylece goForward/goBackward sırasında içerik zaten hazır olur, boş an yaşanmaz.
  useEffect(() => {
    if (!activeUnit) return;
    const neighbors = [contents[selectedTopicIndex + 1], contents[selectedTopicIndex - 1]].filter(
      (t): t is Content => !!t && !t.contentLoaded
    );
    neighbors.forEach((topic) => {
      void ensureTopicContentLoaded(topic, activeUnit);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopicIndex, contents, activeUnit?.id]);

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

  // Alt başlıklar artık aynı sayfada birlikte göründüğü için "ileri/geri" önce
  // içerik alanını kaydırır; sayfanın sonuna/başına ulaşınca bir sonraki/önceki
  // konuya geçer.
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
    if (selectedTopicIndex >= totalTopics - 1) return;
    runViewTransition('forward', () => {
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
    if (selectedTopicIndex <= 0) return;
    runViewTransition('backward', () => {
      goToTopic(selectedTopicIndex - 1);
    });
  };

  const isAtVeryStart = selectedTopicIndex <= 0;
  const isAtVeryEnd = selectedTopicIndex >= totalTopics - 1;

  const renderTopicItem = (topic: Content, idx: number, unit: Unit, isActiveUnitList: boolean) => {
    const isActive = isActiveUnitList && idx === selectedTopicIndex;
    const isCompleted = isActiveUnitList && idx < selectedTopicIndex;
    const showAdminMenu = isAdmin && !tocCollapsed;
    const hasSections = !!topic.sections?.length;
    const isTopicExpanded = expandedTopicIds.has(String(topic.id));
    const showExpandToggle = hasSections && !tocCollapsed;
    const showSectionTree = showExpandToggle && isTopicExpanded;
    const rightControlsCount = (showExpandToggle ? 1 : 0) + (showAdminMenu ? 1 : 0);
    const topicSectionSlugs = showSectionTree ? buildSectionSlugs(topic.sections!) : null;

    const handleTopicClick = () => {
      if (isActiveUnitList) {
        goToTopic(idx);
      } else {
        selectUnitTopic(unit, topic.id);
      }
    };

    const handleSectionClick = (slug: string) => {
      if (isActiveUnitList) {
        goToSectionAnchor(slug);
      } else {
        selectUnitSection(unit, topic.id, slug);
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
                        <Sparkles className="h-3.5 w-3.5" /> Kazanım / Kapak / Anahtar Kavramlar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopicMenuOpenId(null);
                          setCoverImageModalTopicId(Number(topic.id));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ImagePlus className="h-3.5 w-3.5" /> Konu Kapak Görseli
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopicMenuOpenId(null);
                          setTopicHighlightsModalTopicId(Number(topic.id));
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Anahtar Kavramları Güncelle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopicMenuOpenId(null);
                          setTopicQuestionsModalTopic({ id: Number(topic.id), title: topic.title, variant: 'general' });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ListChecks className="h-3.5 w-3.5" /> Genel Sorular (Diğer AI)
                        {questionStatusByTopic[topic.id]?.general && (
                          <Check className="h-3.5 w-3.5 ml-auto text-emerald-500" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopicMenuOpenId(null);
                          setTopicQuestionsModalTopic({ id: Number(topic.id), title: topic.title, variant: 'classical' });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <ListChecks className="h-3.5 w-3.5" /> Açık Uçlu Sorular
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTopicMenuOpenId(null);
                          setClassicalGenerateTarget({ topicId: Number(topic.id), topicTitle: topic.title, section: null });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Açık Uçlu Soru Üret (AI)
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
            const slug = topicSectionSlugs!.get(section.id)!;
            const isSectionActive = isActiveUnitList && activeSectionSlug === slug;
            return (
              <div key={section.id} className="relative">
                <button
                  type="button"
                  onClick={() => handleSectionClick(slug)}
                  title={section.heading}
                  className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${isAdmin ? 'pr-7' : ''} ${
                    isSectionActive
                      ? 'bg-indigo-100 text-indigo-700 font-black'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                >
                  <span className="truncate">{sIdx + 1}. {section.heading}</span>
                  {questionStatusByTopic[topic.id]?.sectionIds.includes(Number(section.id)) && (
                    <span title="Bu alt başlığa soru eklenmiş" className="shrink-0">
                      <Check className="h-3 w-3 text-emerald-500" />
                    </span>
                  )}
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
                            <Clipboard className="h-3.5 w-3.5" /> İçerik Ekle
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setImageModalTarget({
                                topicId: Number(topic.id),
                                section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt, image_alt: section.imageAlt },
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <ImagePlus className="h-3.5 w-3.5" /> Görsel Ekle
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setDiagramModalTarget({
                                topicId: Number(topic.id),
                                section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt, image_alt: section.imageAlt, diagram_svg: section.diagramSvg },
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <Shapes className="h-3.5 w-3.5" /> Diyagram Ekle
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
                            {questionStatusByTopic[topic.id]?.sectionIds.includes(Number(section.id)) && (
                              <Check className="h-3.5 w-3.5 ml-auto text-emerald-500" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setQuestionsModalTarget({
                                topicId: Number(topic.id),
                                section: { id: Number(section.id), heading: section.heading },
                                variant: 'classical',
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <ListChecks className="h-3.5 w-3.5" /> Açık Uçlu Soru Ekle
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSectionMenuOpenId(null);
                              setClassicalGenerateTarget({
                                topicId: Number(topic.id),
                                topicTitle: topic.title,
                                section: { id: Number(section.id), heading: section.heading },
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Açık Uçlu Soru Üret (AI)
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
    <div className="flex h-[calc(100dvh-60px)] sm:h-[calc(100dvh-72px)] flex-col bg-[#f9fafb] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

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
          <div className="border-b border-slate-100 shrink-0">
            <div className="p-4 pb-2 flex items-center justify-between">
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
            {/* Sınıf + ders — ünitelerin hemen üstünde, belirgin bir rozet olarak (kullanıcının
                2026-09-05 isteği: "biraz daha belirgin olsun"; eskiden "Müfredata Dön"
                linkinin altında ufak gri bir alt yazıydı, kolayca gözden kaçıyordu). */}
            {!tocCollapsed && (
              <div className="px-4 pb-3">
                <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-black text-indigo-700">
                  {gradeName} {lessonName}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1" style={{ scrollbarWidth: 'none' }}>
            {tocCollapsed ? (
              contents.length > 0 ? contents.map((topic, idx) => renderTopicItem(topic, idx, activeUnit as Unit, true)) : (
                <div className="text-center p-4 text-sm text-slate-400 font-medium">Konular yükleniyor...</div>
              )
            ) : sortedUnits.length > 0 ? sortedUnits.map((unit) => {
              const isActiveUnit = String(unit.id) === String(activeUnit?.id);
              const isDraftUnit = unit.is_active === false;
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
                      isDraftUnit ? 'bg-amber-50/60' : isActiveUnit ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDraftUnit ? 'bg-amber-500' : isActiveUnit ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                    <span className={`flex-1 min-w-0 truncate text-xs font-black uppercase tracking-wide ${isDraftUnit ? 'text-amber-700' : isActiveUnit ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {unit.title}
                    </span>
                    {isDraftUnit && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                        Taslak
                      </span>
                    )}
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

              <div className="grid grid-cols-1 gap-5 items-start lg:grid-cols-[1fr_260px]">
              {/* SOL SÜTUN: hiyerarşi barı + mobil konu dropdown'u + içerik kartı — sağdaki
                  260px'lik özet sütunuyla AYNI grid satırında, aynı hizada kalsınlar diye
                  hepsi tek bir grid item (kullanıcının 2026-09-05 bildirdiği bug: hiyerarşi
                  barı önceden bu grid'in DIŞINDA, tam container genişliğindeydi — bu da onu
                  sağdaki özet sütununun üzerine taşıyormuş gibi görünmesine yol açıyordu). */}
              <div className="min-w-0">

              {/* Ders/Ünite hiyerarşi barı — hangi sınıf/ders/ünitede olduğun her zaman
                  belirgin olsun ve sayfadan çıkmadan hızlıca sınıf/ders/ünite değiştirebilesin
                  diye (bkz. kullanıcının 2026-09-05 isteği). Mobilde de görünür — eski
                  breadcrumb sadece sm+ ekranlarda görünüyordu. Sınıf/Ders/Ünite İKİ satıra
                  bölünmüş (ikonlar + sınıf üstte, ders + ünite altta) — hepsi tek satırda
                  olunca (kullanıcının 2026-09-05 şikayeti) ünite adı "Gök..." gibi kırpılıyordu;
                  Ders/Ünite'nin kendi satırında yarım yarıya yer alması bunu çözüyor. Sınıf/Ders
                  seçimi, Ünite seçilene kadar sadece BEKLEYEN bir seçimdir — sayfa/içerik
                  değişmez, sadece dropdown'lar yeniden dolar (bkz. handleGradeDropdownSelect/
                  handleLessonDropdownSelect/handleUnitDropdownSelect). */}
              <div className="mb-4 flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-2.5 shadow-lg shadow-indigo-500/20 sm:p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/25 lg:hidden"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                  <Link
                    href="/"
                    title="Anasayfa"
                    className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-colors hover:bg-white/25 sm:flex"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Link>

                  {/* Sınıf değiştirici — Ders'in yanında, kompakt (kullanıcının 2026-09-05
                      isteği: "dersi sınıfın yanına al") */}
                  <div className="relative min-w-0 flex-none">
                    <button
                      type="button"
                      onClick={() => { setGradeSwitcherOpen((v) => !v); setLessonSwitcherOpen(false); setUnitSwitcherOpen(false); setTopicSwitcherOpen(false); }}
                      className="flex flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Sınıf</span>
                      <span className="flex items-center gap-1.5 text-sm font-black text-white">
                        {pendingGradeName || gradeName} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${gradeSwitcherOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {gradeSwitcherOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setGradeSwitcherOpen(false)} />
                        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          {allGrades.map((grade) => (
                            <button
                              key={grade.id}
                              type="button"
                              onClick={() => handleGradeDropdownSelect(grade)}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                                grade.id === pendingGradeId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="min-w-0 truncate">{grade.name}</span>
                            </button>
                          ))}
                          {!allGrades.length && (
                            <span className="block px-2.5 py-2 text-sm text-slate-400">{pendingGradeName || gradeName}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Ders (lesson) değiştirici */}
                  <div className="relative min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => { setLessonSwitcherOpen((v) => !v); setUnitSwitcherOpen(false); setGradeSwitcherOpen(false); setTopicSwitcherOpen(false); }}
                      className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ders</span>
                      <span className="flex w-full items-center gap-1.5">
                        <span className={`min-w-0 flex-1 truncate text-sm text-white ${pendingLessonId == null ? 'italic text-white/70' : 'font-black'}`}>
                          {pendingLessonId == null ? 'Ders seçin' : pendingLessonName}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${lessonSwitcherOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {lessonSwitcherOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setLessonSwitcherOpen(false)} />
                        <div className="absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          {pendingLessons.map((lesson, idx) => (
                            <button
                              key={lesson.id}
                              type="button"
                              onClick={() => handleLessonDropdownSelect(lesson)}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                                lesson.id === pendingLessonId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${getLessonColor(idx)} text-sm text-white`}>
                                {lesson.icon || '📘'}
                              </span>
                              <span className="min-w-0 truncate">{lesson.name}</span>
                            </button>
                          ))}
                          {!pendingLessons.length && (
                            <span className="block px-2.5 py-2 text-sm text-slate-400">{pendingLoading ? 'Yükleniyor…' : 'Bu sınıfta ders yok'}</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Ünite değiştirici — artık kendi satırında tek başına (tam genişlik),
                      ünite adları uzun olduğunda daha az kırpılsın diye. */}
                  <div className="relative min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => { setUnitSwitcherOpen((v) => !v); setLessonSwitcherOpen(false); setGradeSwitcherOpen(false); setTopicSwitcherOpen(false); }}
                      className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Ünite</span>
                      <span className="flex w-full items-center gap-1.5">
                        <span className={`min-w-0 flex-1 truncate text-sm text-white ${pendingUnitId == null ? 'italic text-white/70' : 'font-bold'}`}>
                          {pendingUnitId == null ? 'Ünite seçin' : pendingUnitName}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${unitSwitcherOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {unitSwitcherOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setUnitSwitcherOpen(false)} />
                        <div className="absolute right-0 top-full z-50 mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          {pendingUnits.map((unit) => (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => void handleUnitDropdownSelect(unit)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                                unit.id === pendingUnitId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="min-w-0 truncate">{unit.title}</span>
                            </button>
                          ))}
                          {!pendingUnits.length && (
                            <span className="block px-2.5 py-2 text-sm text-slate-400">
                              {pendingLessonId == null ? 'Önce ders seçin' : pendingLoading ? 'Yükleniyor…' : 'Bu ders + sınıfta ünite yok'}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Konu (topic) değiştirici — eskiden hiyerarşi barının ALTINDA ayrı, farklı
                    renkli (mor) bir "İçindekiler" kutusuydu; kullanıcının 2026-09-05 isteğiyle
                    Sınıf/Ders/Ünite ile AYNI menüye, aynı renge taşındı ve statik "İçindekiler"
                    yazısı yerine artık aktif konunun adını gösteriyor (Ünite pill'iyle aynı
                    mantık). Ünitenin tek konusu olsa bile gösterilir — Sınıf/Ders/Ünite'yle
                    aynı hizada, tutarlı dursun diye (kullanıcının 2026-09-05 tercihi; aşağıdaki
                    önceki/sonraki konu navigasyonu hâlâ >1 konu şartı arıyor, o farklı bir amaç).
                    Zincirde bir üst seviye (sınıf/ders/ünite) değiştiyse "Konu seçin" placeholder'ı
                    görünür — asıl sayfa/içerik yenilemesi ancak burada bir konu seçilince olur. */}
                {contents.length > 0 && (
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => { setTopicSwitcherOpen((v) => !v); setLessonSwitcherOpen(false); setGradeSwitcherOpen(false); setUnitSwitcherOpen(false); }}
                      className="flex w-full flex-col items-start rounded-xl bg-white/20 px-3 py-1.5 text-left transition-colors hover:bg-white/30"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/70">Konu</span>
                      <span className="flex w-full items-center gap-1.5">
                        <span className={`min-w-0 flex-1 truncate text-sm text-white ${!isChainFullyResolved ? 'italic text-white/70' : 'font-bold'}`}>
                          {isChainFullyResolved ? (activeTopic?.title || unitTitle) : 'Konu seçin'}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform text-white ${topicSwitcherOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {topicSwitcherOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setTopicSwitcherOpen(false)} />
                        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                          {konuDropdownOptions.map((topic, idx) => {
                            const isActiveTopic = isChainFullyResolved && String(topic.id) === String(activeTopic?.id);
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                onClick={() => handleTopicDropdownSelect(topic)}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors ${
                                  isActiveTopic ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span className="shrink-0 text-xs font-black text-slate-400">{idx + 1}</span>
                                <span className="min-w-0 truncate">{topic.title}</span>
                              </button>
                            );
                          })}
                          {!konuDropdownOptions.length && (
                            <span className="block px-2.5 py-2 text-sm text-slate-400">
                              {pendingUnitId == null ? 'Önce ünite seçin' : pendingLoading ? 'Yükleniyor…' : 'Bu ünitede konu yok'}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

                {/* CONTENT CARD */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 min-w-0" style={{ viewTransitionName: 'ders-content' }}>
                  <div className="p-5 sm:p-8 lg:p-10">
                    {activeTopic && (
                      <div className="not-prose mb-8 sm:mb-10 pb-8 sm:pb-10 border-b border-rose-100 text-center">
                        <p className="text-base sm:text-lg font-black uppercase tracking-[0.2em] text-rose-400">{unitTitle}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                          <h1 className="font-serif text-3xl sm:text-4xl font-black text-rose-600 leading-tight">{activeTopic.title}</h1>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setNotebookPlanTopicId(Number(activeTopic.id))}
                              title="Google NotebookLM için tek prompt'u kopyala"
                              className="inline-flex h-7 items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2.5 text-[11px] font-black text-rose-500 shadow-sm hover:bg-rose-100 transition-colors"
                            >
                              <Clipboard className="h-3 w-3" /> NotebookLM Prompt&apos;u
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setTopicQuestionsModalTopic({ id: Number(activeTopic.id), title: activeTopic.title, variant: 'notebooklm' })}
                              title="Konunun geneline ait, ünite testinde kullanılacak sentez soruları üret"
                              className="inline-flex h-7 items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2.5 text-[11px] font-black text-rose-500 shadow-sm hover:bg-rose-100 transition-colors"
                            >
                              <ListChecks className="h-3 w-3" /> Genel Sorular
                              {questionStatusByTopic[activeTopic.id]?.general && (
                                <Check className="h-3 w-3 text-emerald-600" />
                              )}
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setTopicQuestionsModalTopic({ id: Number(activeTopic.id), title: activeTopic.title, variant: 'classical_notebooklm' })}
                              title="Konunun geneline ait, kitaba dayanan açık uçlu sentez soruları üret"
                              className="inline-flex h-7 items-center gap-1 rounded-full bg-rose-50 border border-rose-100 px-2.5 text-[11px] font-black text-rose-500 shadow-sm hover:bg-rose-100 transition-colors"
                            >
                              <Sparkles className="h-3 w-3" /> Açık Uçlu Sorular
                            </button>
                          )}
                        </div>
                        <div className="mx-auto mt-4 h-1 w-14 rounded-full bg-rose-200" />
                        {activeTopic.subtitle && (
                          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-slate-500 font-medium leading-relaxed">{activeTopic.subtitle}</p>
                        )}
                      </div>
                    )}
                    {activeTopic?.heroImageUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setHeroImageZoomed(true)}
                          title="Büyütmek için tıkla"
                          className="not-prose mb-8 block w-full cursor-zoom-in rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 transition hover:border-slate-200 hover:shadow-md"
                        >
                          <img
                            src={activeTopic.heroImageUrl}
                            alt={buildTopicImageAlt(activeTopic.title, lessonName, gradeName, activeTopic.heroImageAlt)}
                            className="w-full max-h-[420px] object-contain"
                            fetchPriority="high"
                            decoding="async"
                          />
                        </button>
                        {heroImageZoomed && typeof document !== 'undefined' && createPortal(
                          <div
                            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 sm:p-8"
                            onClick={() => setHeroImageZoomed(false)}
                          >
                            <div
                              className="relative max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setHeroImageZoomed(false)}
                                aria-label="Kapat"
                                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                              >
                                ✕
                              </button>
                              <img
                                src={activeTopic.heroImageUrl}
                                alt={buildTopicImageAlt(activeTopic.title, lessonName, gradeName, activeTopic.heroImageAlt)}
                                className="mx-auto h-auto w-full max-h-[80vh] object-contain"
                                decoding="async"
                              />
                            </div>
                          </div>,
                          document.body
                        )}
                      </>
                    )}
                    {activeTopic && (isAdmin || (activeTopic.highlights && activeTopic.highlights.length > 0)) && (
                      <div className="not-prose mb-8">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest">
                            <Sparkles className="h-4 w-4" /> Anahtar Kavramlar
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setHighlightQuickAddTopicId(Number(activeTopic.id))}
                                title="Yeni anahtar kavram ekle"
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTopicHighlightsModalTopicId(Number(activeTopic.id))}
                                title="Anahtar kavramları güncelle"
                                className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {activeTopic.highlights && activeTopic.highlights.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {activeTopic.highlights.map((h, idx) => (
                              <HighlightCard
                                key={idx}
                                highlight={h}
                                onEdit={isAdmin ? () => setHighlightEditTarget({ topicId: Number(activeTopic.id), index: idx }) : undefined}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Henüz anahtar kavram eklenmemiş.</p>
                        )}
                      </div>
                    )}
                    {activeTopic ? (
                      <div className="prose prose-sm sm:prose lg:prose-base max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-indigo-700 prose-strong:font-extrabold prose-ul:text-slate-700 prose-li:marker:text-indigo-400 prose-li:text-base prose-li:mb-1.5">
                        {activeTopic.sections && activeTopic.sections.length > 0 ? (
                          <div>
                            {activeTopic.sections.map((section) => {
                              const slug = activeTopicSectionSlugs.get(section.id) || String(section.id);
                              return (
                                <section
                                  key={section.id}
                                  id={slug}
                                  data-section-anchor={slug}
                                  className="scroll-mt-4 mt-10 border-t-2 border-rose-100 pt-10 first:mt-0 first:border-t-0 first:pt-0"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-5">
                                    <h2 className="not-prose flex-1 min-w-0 flex items-center gap-2 text-xl sm:text-2xl font-black text-rose-600 leading-snug">
                                      {section.heading}
                                      {isAdmin && questionStatusByTopic[activeTopic.id]?.sectionIds.includes(Number(section.id)) && (
                                        <span title="Bu alt başlığa soru eklenmiş" className="shrink-0">
                                          <Check className="h-4 w-4 text-emerald-500" />
                                        </span>
                                      )}
                                    </h2>

                                    {isAdmin && (
                                      <div className="not-prose relative shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setContentSectionMenuOpenId((cur) => (String(cur) === String(section.id) ? null : section.id))}
                                          className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                          <MoreVertical className="h-4 w-4" />
                                        </button>

                                        {String(contentSectionMenuOpenId) === String(section.id) && (
                                          <>
                                            <div className="fixed inset-0 z-40" onClick={() => setContentSectionMenuOpenId(null)} />
                                            <div className="absolute right-0 top-8 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setContentSectionMenuOpenId(null);
                                                  setSectionModalTarget({
                                                    topicId: Number(activeTopic.id),
                                                    section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt },
                                                    variant: 'notebooklm',
                                                  });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                              >
                                                <Clipboard className="h-3.5 w-3.5" /> İçerik Ekle (NotebookLM)
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setContentSectionMenuOpenId(null);
                                                  setImageModalTarget({
                                                    topicId: Number(activeTopic.id),
                                                    section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt, image_alt: section.imageAlt },
                                                  });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                              >
                                                <ImagePlus className="h-3.5 w-3.5" /> Görsel Ekle
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setContentSectionMenuOpenId(null);
                                                  setDiagramModalTarget({
                                                    topicId: Number(activeTopic.id),
                                                    section: { id: Number(section.id), heading: section.heading, image_url: section.imageUrl, image_prompt: section.imagePrompt, image_alt: section.imageAlt, diagram_svg: section.diagramSvg },
                                                  });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                              >
                                                <Shapes className="h-3.5 w-3.5" /> Diyagram Ekle
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setContentSectionMenuOpenId(null);
                                                  setQuestionsModalTarget({
                                                    topicId: Number(activeTopic.id),
                                                    section: { id: Number(section.id), heading: section.heading },
                                                    variant: 'notebooklm',
                                                  });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                              >
                                                <ListChecks className="h-3.5 w-3.5" /> Soru Ekle (NotebookLM)
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setContentSectionMenuOpenId(null);
                                                  setQuestionsModalTarget({
                                                    topicId: Number(activeTopic.id),
                                                    section: { id: Number(section.id), heading: section.heading },
                                                    variant: 'classical_notebooklm',
                                                  });
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                                              >
                                                <Sparkles className="h-3.5 w-3.5" /> Açık Uçlu Soru Ekle (NotebookLM)
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {section.html || section.imageUrl || section.diagramSvg ? (
                                    <SectionContent
                                      html={section.html || ''}
                                      imageUrl={section.imageUrl}
                                      caption={section.heading}
                                      imageAlt={buildSectionImageAlt(section.heading, activeTopic.title, lessonName, gradeName, section.imageAlt)}
                                      diagramSvg={section.diagramSvg}
                                    />
                                  ) : (
                                    <p className="not-prose text-sm text-slate-400 font-medium italic">İçerik hazırlanıyor.</p>
                                  )}
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => openContentEditModal(section.id)}
                                      disabled={loadingEditSectionId === section.id}
                                      className="not-prose mt-5 flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      {loadingEditSectionId === section.id ? 'Yükleniyor...' : 'İçeriği Düzenle'}
                                    </button>
                                  )}
                                </section>
                              );
                            })}
                          </div>
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
                    {activeTopic && contents.length > 1 && (() => {
                      const prevTopic = contents[selectedTopicIndex - 1] ?? null;
                      const nextTopic = contents[selectedTopicIndex + 1] ?? null;
                      const prevHref = prevTopic ? buildTopicHref(gradeSlug, lessonSlug, activeUnitSlug, prevTopic.slug || null) : null;
                      const nextHref = nextTopic ? buildTopicHref(gradeSlug, lessonSlug, activeUnitSlug, nextTopic.slug || null) : null;
                      return (
                        <nav aria-label="Konu navigasyonu" className="not-prose mt-10 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-6">
                          {prevTopic && prevHref && (
                            <Link
                              href={prevHref}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
                              <span className="min-w-0">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Önceki Konu</span>
                                <span className="block truncate text-sm font-bold text-slate-700">{prevTopic.title}</span>
                              </span>
                            </Link>
                          )}
                          {nextTopic && nextHref && (
                            <Link
                              href={nextHref}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Sonraki Konu</span>
                                <span className="block truncate text-sm font-bold text-slate-700">{nextTopic.title}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            </Link>
                          )}
                        </nav>
                      );
                    })()}
                    {activeTopic && <TopicCompleteButton topicId={activeTopic.id} />}
                    {activeTopic && (
                      <QuizCtaCards
                        topicId={activeTopic.id}
                        topicHref={buildTopicTestHref(gradeSlug, lessonSlug, activeUnitSlug, activeTopic.slug || null)}
                        questionBankHref={buildTopicQuestionBankHref(gradeSlug, lessonSlug, activeUnitSlug, activeTopic.slug || null)}
                        unitTitle={unitTitle}
                        unitHref={
                          gradeSlug && lessonSlug && activeUnitSlug
                            ? `/${gradeSlug}/${lessonSlug}/${activeUnitSlug}/unite-testi`
                            : `/karisik-test?lesson_id=${lessonId}&week=${week}`
                        }
                        showUnitCard={activeUnit?.has_questions !== false || isAdmin}
                        unitQuestionCount={activeUnit?.test_question_count}
                      />
                    )}
                    {activeTopic && activeUnit && (
                      <div className="not-prose mt-8">
                        <UnitDiscussion
                          gradeId={Number(gradeId)}
                          lessonId={Number(lessonId)}
                          unitId={Number(activeUnit.id)}
                          unitName={unitTitle}
                          defaultExpanded
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* RIGHT SIDEBAR: kazanımlar + ünite özeti + MEB takvimi + ipucu */}
                <div className="flex flex-col gap-4 lg:sticky lg:top-4">
                  <button
                    type="button"
                    onClick={openKazanimlarModal}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 text-sm font-black text-emerald-600 shadow-sm hover:bg-emerald-100 transition-colors"
                  >
                    <Target className="h-4 w-4" /> Kazanımlar
                  </button>

                  {unitQuestionSummary && (
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-violet-600 font-black text-xs uppercase tracking-widest">
                          <ListChecks className="h-4 w-4" /> Ünite Özeti
                        </div>
                        <span className="inline-flex items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-black text-violet-700 shrink-0">
                          {unitQuestionSummary.total} Soru
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {unitQuestionSummary.topics.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 text-xs font-medium">
                            <span className={`truncate ${String(t.id) === String(activeTopic?.id) ? 'text-violet-700 font-black' : 'text-slate-500'}`}>
                              {t.title}
                            </span>
                            <span className="shrink-0 font-black text-slate-700">{t.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeTopic && (
                    <CurriculumWeekCard weekRangeLabel={curriculumWeekRangeLabel} dateRangeLabel={curriculumDateRangeLabel} />
                  )}

                  <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-widest mb-2">
                      <Lightbulb className="h-4 w-4" /> Biliyor musun?
                    </div>
                    <p className="text-sm text-amber-900/80 font-medium leading-relaxed">{studyTip}</p>
                  </div>
                </div>
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
                {totalTopics ? selectedTopicIndex + 1 : 0} / {totalTopics}
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
              <span className="flex flex-col items-center leading-tight">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Hafta {kazanimlarWeek} / {totalCalendarWeeks}</span>
                <span className="text-[10px] font-medium text-slate-400">{kazanimlarWeekDateLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => goToKazanimlarWeek(kazanimlarWeek + 1)}
                disabled={kazanimlarWeek >= totalCalendarWeeks}
                className="h-8 w-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-white hover:shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="h-[60vh] overflow-y-auto p-4 space-y-2">
              {specialWeeksForSelectedWeek?.map((sw) => {
                const meta = SPECIAL_WEEK_META[sw.eventType];
                const dateLabel =
                  sw.startDate && sw.endDate
                    ? sw.startDate === sw.endDate
                      ? new Date(`${sw.startDate}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
                      : `${new Date(`${sw.startDate}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – ${new Date(`${sw.endDate}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`
                    : null;
                return (
                  <div key={sw.id} className={`p-3 rounded-xl border flex items-start gap-2.5 ${meta.card}`}>
                    <span className="text-lg leading-none shrink-0">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold leading-relaxed">{sw.title}</p>
                        {dateLabel && <span className="text-[11px] font-semibold opacity-70 shrink-0">{dateLabel}</span>}
                      </div>
                      {sw.subtitle && <p className="text-xs font-medium opacity-80 mt-0.5">{sw.subtitle}</p>}
                      {sw.contentHtml && (
                        <div
                          className="text-xs font-medium opacity-90 mt-1.5 leading-relaxed whitespace-pre-line [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:space-y-0.5"
                          dangerouslySetInnerHTML={{ __html: sw.contentHtml }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {isAdminGapWeek && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-start gap-2.5">
                  <span className="text-lg leading-none shrink-0">⚠️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-relaxed">Bu hafta için içerik tanımlı değil</p>
                    <p className="text-xs font-medium opacity-80 mt-0.5">
                      Ne kazanım ne de özel hafta (tatil/içerik/etkinlik) bulundu — yıllık plan veya özel hafta
                      girişlerinde bir eksiklik olabilir. Sadece adminler görür.
                    </p>
                  </div>
                </div>
              )}
              {kazanimlarForSelectedWeek === null ? (
                <div className="py-10 text-center text-sm font-medium text-slate-400">Yükleniyor...</div>
              ) : kazanimlarForSelectedWeek.length === 0 && kazanimlarTeachingWeek != null && !isAdminGapWeek ? (
                <div className="py-10 text-center text-sm font-medium text-slate-400">Bu hafta için kazanım bulunamadı.</div>
              ) : (
                kazanimlarForSelectedWeek.map((o, idx) => {
                  const isEditing = isAdmin && editingOutcomeId != null && String(editingOutcomeId) === String(o.id ?? idx);
                  if (isEditing) {
                    return (
                      <div key={o.id || idx} className="bg-white p-3 rounded-xl border-2 border-indigo-200 space-y-2.5">
                        <textarea
                          value={outcomeEditForm.description}
                          onChange={(e) => setOutcomeEditForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="w-full text-sm font-medium text-slate-700 leading-relaxed rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Öğretim Haftası</label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={outcomeEditForm.startWeek}
                            onChange={(e) => setOutcomeEditForm((f) => ({ ...f, startWeek: e.target.value }))}
                            className="w-16 text-sm rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                          <span className="text-slate-400 text-xs">–</span>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={outcomeEditForm.endWeek}
                            onChange={(e) => setOutcomeEditForm((f) => ({ ...f, endWeek: e.target.value }))}
                            className="w-16 text-sm rounded-lg border border-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                        {outcomeEditError && <p className="text-xs font-semibold text-red-600">{outcomeEditError}</p>}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={saveOutcomeEdit}
                            disabled={savingOutcomeEdit}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                            {savingOutcomeEdit ? 'Kaydediliyor...' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelOutcomeEdit}
                            disabled={savingOutcomeEdit}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={o.id || idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2.5">
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-mono font-bold bg-emerald-100 text-emerald-700">
                        {o.code || o.previewCode}
                      </span>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed flex-1">{o.description}</p>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openOutcomeEdit(o)}
                          title="Kazanımı düzenle (metin + hafta)"
                          className="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
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

      {notebookPlanTopicId != null && (
        <NotebookPlanModal
          topicId={notebookPlanTopicId}
          onClose={() => setNotebookPlanTopicId(null)}
          onSaved={() => {
            setNotebookPlanTopicId(null);
            refreshWeekData();
          }}
          onManageMore={() => {
            const topicId = notebookPlanTopicId;
            setNotebookPlanTopicId(null);
            setManagingTopicId(topicId);
          }}
        />
      )}

      {sectionModalTarget && (
        <SectionModal
          topicId={sectionModalTarget.topicId}
          section={sectionModalTarget.section}
          variant={sectionModalTarget.variant}
          onClose={() => setSectionModalTarget(null)}
          onSaved={() => {
            setSectionModalTarget(null);
            refreshWeekData();
          }}
        />
      )}

      {imageModalTarget && (
        <ImageModal
          topicId={imageModalTarget.topicId}
          section={imageModalTarget.section}
          onClose={() => setImageModalTarget(null)}
          onSaved={refreshWeekData}
          onImageChanged={refreshWeekData}
        />
      )}

      {diagramModalTarget && (
        <DiagramModal
          topicId={diagramModalTarget.topicId}
          section={diagramModalTarget.section}
          onClose={() => setDiagramModalTarget(null)}
          onSaved={refreshWeekData}
        />
      )}

      {questionsModalTarget && (
        <QuestionsModal
          topicId={questionsModalTarget.topicId}
          section={questionsModalTarget.section}
          variant={questionsModalTarget.variant}
          onClose={() => {
            setQuestionsModalTarget(null);
            loadQuestionStatus();
          }}
        />
      )}

      {editingContentSection && (
        <SectionContentEditModal
          section={editingContentSection}
          onClose={() => setEditingContentSection(null)}
          onSaved={() => {
            setEditingContentSection(null);
            refreshWeekData();
          }}
        />
      )}

      {coverImageModalTopicId != null && (
        <TopicCoverImageModal
          topicId={coverImageModalTopicId}
          onClose={() => setCoverImageModalTopicId(null)}
          onSaved={refreshWeekData}
        />
      )}

      {topicHighlightsModalTopicId != null && (
        <TopicHighlightsModal
          topicId={topicHighlightsModalTopicId}
          onClose={() => setTopicHighlightsModalTopicId(null)}
          onSaved={refreshWeekData}
        />
      )}

      {topicQuestionsModalTopic && (
        <TopicQuestionsModal
          topicId={topicQuestionsModalTopic.id}
          topicTitle={topicQuestionsModalTopic.title}
          variant={topicQuestionsModalTopic.variant}
          onClose={() => {
            setTopicQuestionsModalTopic(null);
            loadQuestionStatus();
          }}
        />
      )}

      {classicalGenerateTarget && (
        <ClassicalGenerateModal
          topicId={classicalGenerateTarget.topicId}
          topicTitle={classicalGenerateTarget.topicTitle}
          section={classicalGenerateTarget.section}
          onClose={() => {
            setClassicalGenerateTarget(null);
            loadQuestionStatus();
          }}
        />
      )}

      {highlightQuickAddTopicId != null && (
        <TopicHighlightQuickAddModal
          topicId={highlightQuickAddTopicId}
          onClose={() => setHighlightQuickAddTopicId(null)}
          onSaved={refreshWeekData}
        />
      )}

      {highlightEditTarget && (
        <TopicHighlightEditModal
          topicId={highlightEditTarget.topicId}
          index={highlightEditTarget.index}
          onClose={() => setHighlightEditTarget(null)}
          onSaved={refreshWeekData}
        />
      )}
    </div>
  );
}
