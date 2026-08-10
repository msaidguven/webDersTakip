'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Check,
  Settings,
  MoreVertical,
  Volume2,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Sparkles,
} from 'lucide-react';
import AdminTopicSectionsModal from '@/app/src/components/admin/AdminTopicSectionsModal';

type Outcome = { id?: string | number; description: string; topicId?: string | number | null };
type Content = { id: string | number; title: string; content?: string | null };
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

const STUDY_TIPS = [
  'Bir konuyu okuduktan sonra kendi cümlelerinle özetlemek, kalıcılığı artırır.',
  'Kısa aralıklarla tekrar etmek, tek seferde uzun çalışmaktan daha etkilidir.',
  'Öğrendiğin bir konuyu birine anlatmayı dene, eksiklerin hemen ortaya çıkar.',
  'Not alarak okumak, sadece okumaktan daha kalıcı öğrenme sağlar.',
  'Zor gelen kısımları atlamak yerine üzerinde durup anlamaya çalış.',
];

function CircularProgress({ percent }: { percent: number }) {
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#4f46e5"
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="fill-indigo-700 text-[13px] font-black"
      >
        %{Math.round(percent)}
      </text>
    </svg>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const [outcomesOpen, setOutcomesOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [topicMenuOpenId, setTopicMenuOpenId] = useState<string | number | null>(null);
  const [managingTopicId, setManagingTopicId] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedTopicIndex = useMemo(() => {
    const idx = contents.findIndex((c) => String(c.id) === String(activeTopicId));
    return idx >= 0 ? idx : 0;
  }, [contents, activeTopicId]);

  const selectedTopicId = contents[selectedTopicIndex]?.id ?? null;
  const activeTopic = contents[selectedTopicIndex];

  const activeTopicOutcomes = useMemo(() => {
    if (!selectedTopicId) return outcomes;
    const matchingOutcomes = outcomes.filter((outcome) => String(outcome.topicId ?? '') === String(selectedTopicId));
    return matchingOutcomes.length ? matchingOutcomes : outcomes.filter((outcome) => outcome.topicId == null);
  }, [outcomes, selectedTopicId]);

  const studyTip = STUDY_TIPS[selectedTopicIndex % STUDY_TIPS.length];

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

  const handleCopyPrompt = async () => {
    if (isWeekDataLoading) return;

    setCopyState('loading');
    try {
      const response = await fetch('/api/admin/lesson-prompt');
      if (!response.ok) {
        throw new Error('Prompt alınamadı');
      }

      const data = await response.json() as { prompt?: string };
      if (!data.prompt) {
        throw new Error('Prompt boş');
      }

      const learningOutcomes = activeTopicOutcomes.length
        ? activeTopicOutcomes.map((outcome, index) => `${index + 1}. ${outcome.description}`).join('\n')
        : 'Bu konu için kazanım bulunamadı.';

      const filledPrompt = data.prompt
        .replaceAll('{grade}', gradeName || '')
        .replaceAll('{subject}', lessonName || '')
        .replaceAll('{unit}', unitTitle || '')
        .replaceAll('{topic}', activeTopic?.title || '')
        .replaceAll('{learning_outcomes}', learningOutcomes);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(filledPrompt);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = filledPrompt;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopyState('copied');
      setMenuOpen(false);
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch (error) {
      console.error('Prompt kopyalama hatası:', error);
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2200);
    }
  };

  const activeUnit = units.find(u => week >= (u.start_week || 1) && week <= (u.end_week || 38)) || units[0];
  const unitTitle = activeUnit?.title || unitName || 'Ünite Bulunamadı';

  const totalTopics = contents.length;
  const progressPercent = totalTopics ? Math.round(((selectedTopicIndex + 1) / totalTopics) * 100) : 0;
  const remainingTopics = Math.max(0, totalTopics - (selectedTopicIndex + 1));
  const remainingMinutes = remainingTopics * 15;
  const remainingLabel = remainingMinutes >= 60
    ? `${Math.floor(remainingMinutes / 60)} saat ${remainingMinutes % 60 ? `${remainingMinutes % 60} dk` : ''}`.trim()
    : `${remainingMinutes} dk`;

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

  useEffect(() => {
    if (!activeUnit?.id) {
      setIsWeekDataLoading(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      gradeId,
      lessonId,
      unitId: String(activeUnit.id),
      week: String(week),
    });

    async function loadWeekData() {
      setIsWeekDataLoading(true);
      try {
        const response = await fetch(`/api/lesson-week-data?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = await response.json() as { outcomes?: Outcome[]; contents?: Content[] };
        if (controller.signal.aborted) return;

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
        if (!controller.signal.aborted) {
          console.error('Hafta verisi yüklenemedi:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsWeekDataLoading(false);
        }
      }
    }

    loadWeekData();
    return () => controller.abort();
  }, [activeUnit?.id, gradeId, lessonId, week]);

  const goToTopic = (index: number) => {
    const topic = contents[index];
    if (topic) setActiveTopicId(topic.id);
  };

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

          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40">
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    disabled={copyState === 'loading' || isWeekDataLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {copyState === 'copied' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Clipboard className="h-3.5 w-3.5" />}
                    {isWeekDataLoading ? 'Veri yükleniyor' : copyState === 'loading' ? 'Kopyalanıyor' : copyState === 'copied' ? 'Kopyalandı' : copyState === 'error' ? 'Hata oluştu' : 'Prompt Kopyala'}
                  </button>
                </div>
              )}
            </div>
          )}

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
            {contents.length > 0 ? contents.map((topic, idx) => {
              const isActive = idx === selectedTopicIndex;
              const isCompleted = idx < selectedTopicIndex;
              const showAdminMenu = isAdmin && !tocCollapsed;
              return (
                <div key={topic.id} className="relative">
                  <button
                    onClick={() => goToTopic(idx)}
                    title={topic.title}
                    className={`
                      w-full flex items-center gap-3 rounded-xl transition-all duration-200 border text-left
                      ${tocCollapsed ? 'justify-center p-2.5' : 'p-3'}
                      ${showAdminMenu ? 'pr-8' : ''}
                      ${isActive
                        ? 'bg-indigo-50/80 border-indigo-100/80 shadow-sm'
                        : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'}
                    `}
                  >
                    <div className={`
                      h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-colors
                      ${isCompleted ? 'bg-emerald-100 text-emerald-600' :
                        isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500'}
                    `}>
                      {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    {!tocCollapsed && (
                      <h4 className={`text-sm font-bold leading-snug line-clamp-2 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {topic.title}
                      </h4>
                    )}
                  </button>

                  {showAdminMenu && (
                    <div className="absolute right-1 top-1">
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
                          <div className="absolute right-0 top-7 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                            <button
                              type="button"
                              onClick={() => {
                                setTopicMenuOpenId(null);
                                setManagingTopicId(Number(topic.id));
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              <Sparkles className="h-3.5 w-3.5" /> AI İçerik / Prompt Kopyala
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center p-4 text-sm text-slate-400 font-medium">Konular yükleniyor...</div>
            )}
          </div>

          {/* ÖĞRENME DURUMU */}
          {!tocCollapsed && (
            <div className="p-4 border-t border-slate-100 shrink-0">
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Öğrenme Durumu</div>
              <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                <CircularProgress percent={progressPercent} />
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700">
                    {Math.min(selectedTopicIndex + 1, totalTopics)} / {totalTopics} konu tamamlandı
                  </p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-1">
                    Kalan süre tahmini{remainingLabel ? `: ${remainingLabel}` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
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

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
                {/* CONTENT CARD */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 min-w-0">
                  <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 rounded-t-2xl border-b border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-wider">
                        {totalTopics ? `${selectedTopicIndex + 1}. ` : ''}Konu
                      </p>
                      <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-800 leading-tight truncate">
                        {activeTopic?.title || 'Konu Seçin'}
                      </h2>
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
                    {activeTopic ? (
                      <div className="prose prose-sm sm:prose lg:prose-base max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-slate-800 prose-ul:text-slate-700 prose-li:marker:text-indigo-400 prose-li:text-base">
                        <p className="!mt-0 text-[10px] font-black text-indigo-500 uppercase tracking-widest not-prose mb-4">Konu Anlatımı</p>
                        {activeTopic.content ? (
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

                {/* RIGHT: Biliyor musun? */}
                <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 sm:p-5 lg:sticky lg:top-4">
                  <div className="flex items-center gap-2 text-amber-600 font-black text-xs uppercase tracking-widest mb-2">
                    <Lightbulb className="h-4 w-4" /> Biliyor musun?
                  </div>
                  <p className="text-sm text-amber-900/80 font-medium leading-relaxed">{studyTip}</p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER: Geri / İleri */}
          <footer className="shrink-0 border-t border-slate-200/80 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToTopic(selectedTopicIndex - 1)}
                disabled={selectedTopicIndex <= 0}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed sm:px-6 sm:text-sm"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" /> Geri
              </button>

              <span className="text-xs sm:text-sm font-black text-slate-400">
                {totalTopics ? selectedTopicIndex + 1 : 0} / {totalTopics}
              </span>

              <button
                type="button"
                onClick={() => goToTopic(selectedTopicIndex + 1)}
                disabled={selectedTopicIndex >= totalTopics - 1}
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
    </div>
  );
}
