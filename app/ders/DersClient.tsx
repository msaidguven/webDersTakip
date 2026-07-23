'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  GraduationCap,
  ChevronRight,
  BookOpen,
  PlayCircle,
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Menu,
  X
} from 'lucide-react';

type Outcome = { id?: string | number; description: string };
type Content = { id: string | number; title: string; content?: string | null };
type Unit = { id: number; title: string; slug: string; order_no: number; start_week: number; end_week: number };

interface DersClientProps {
  initialData: {
    gradeName: string;
    lessonName: string;
    unitName: string;
    outcomes: Outcome[];
    contents: Content[];
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

export default function DersClient({ initialData, gradeId, lessonId, week }: DersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { gradeName, lessonName, unitName, outcomes, contents, gradeSlug, lessonSlug } = initialData;

  const [units, setUnits] = useState<Unit[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string | number | null>(contents[0]?.id || null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'konular' | 'hedefler'>('konular');
  const weeksContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const selectedTopicId = useMemo(() => {
    return contents.find(c => c.id === activeTopicId)?.id ?? contents[0]?.id ?? null;
  }, [contents, activeTopicId]);

  const activeTopic = useMemo(() => {
    return contents.find(c => c.id === selectedTopicId) || contents[0];
  }, [contents, selectedTopicId]);

  // Scroll to active week on mount and week change
  useEffect(() => {
    if (weeksContainerRef.current) {
      const activeButton = weeksContainerRef.current.querySelector(`[data-week="${week}"]`);
      if (activeButton) {
        activeButton.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [week]);

  useEffect(() => {
    async function loadUnits() {
      const supabase = createClient();
      let lId = parseInt(lessonId);
      if (isNaN(lId)) {
        const { data: lessonData } = await supabase.from('lessons').select('id').eq('slug', lessonId).single();
        if (lessonData) lId = lessonData.id;
      }
      if (!isNaN(lId)) {
        const { data: unitsData } = await supabase
          .from('units')
          .select('id, title, slug, order_no, start_week, end_week')
          .eq('lesson_id', lId)
          .eq('grade_id', parseInt(gradeId))
          .eq('is_active', true)
          .order('order_no', { ascending: true });

        if (unitsData) {
          setUnits(unitsData as Unit[]);
        }
      }
    }
    loadUnits();
  }, [gradeId, lessonId]);

  const weeks = useMemo(() => {
    const total = 38;
    return Array.from({ length: total }, (_, i) => {
      const no = i + 1;
      return {
        no,
        isActive: no === week,
        isCompleted: no < week,
      };
    });
  }, [week]);

  const handleSelectWeek = (weekNo: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('hafta', String(weekNo));

    if (gradeSlug && lessonSlug) {
      router.push(`/${gradeSlug}/${lessonSlug}?${params.toString()}`);
    } else {
      params.set('sinif', gradeId);
      params.set('ders', lessonId);
      router.push(`/ders?${params.toString()}`);
    }
  };

  useEffect(() => {
    const el = weeksContainerRef.current;
    if (!el) return;

    const handleWeekWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;

      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', handleWeekWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWeekWheel);
  }, []);

  const activeUnit = units.find(u => week >= (u.start_week || 1) && week <= (u.end_week || 38)) || units[0];
  const unitTitle = activeUnit?.title || unitName || 'Ünite Bulunamadı';

  return (
    <div className="flex h-[100dvh] bg-[#f9fafb] text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR: UNITS */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="font-extrabold text-slate-800 leading-tight">{lessonName || 'Ders'}</div>
              <div className="text-xs text-slate-500 font-bold">{gradeName || 'Sınıf'}</div>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 pb-2">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">İlerleme</span>
            <span className="text-xs font-black text-indigo-600">{Math.round((week / 38) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(week / 38) * 100}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ scrollbarWidth: 'none' }}>
          {units.length > 0 ? units.map((u, i) => {
            const isUnitActive = activeUnit?.id === u.id;
            const isUnitCompleted = week > (u.end_week || 38);
            return (
              <div
                key={u.id}
                className={`
                  p-3 rounded-2xl transition-all duration-200 cursor-pointer border group
                  ${isUnitActive
                    ? 'bg-indigo-50/80 border-indigo-100/80 shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100'}
                `}
                onClick={() => handleSelectWeek(u.start_week || 1)}
              >
                <div className="flex gap-3">
                  <div className={`
                    mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black transition-colors
                    ${isUnitCompleted ? 'bg-emerald-100 text-emerald-600' :
                      isUnitActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}
                  `}>
                    {isUnitCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold leading-snug line-clamp-2 ${isUnitActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {u.title}
                    </h4>
                    <p className={`text-[11px] mt-1 font-semibold ${isUnitActive ? 'text-indigo-600/80' : 'text-slate-400'}`}>
                      Hafta {u.start_week} - {u.end_week}
                    </p>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="text-center p-4 text-sm text-slate-400 font-medium">Üniteler yükleniyor...</div>
          )}
        </div>
      </aside>

      {/* RIGHT SIDE: MAIN LAYOUT */}
      <div className="flex-1 flex h-[100dvh] flex-col overflow-hidden bg-white lg:rounded-l-[2rem] shadow-[-20px_0_40px_-15px_rgba(0,0,0,0.03)] border-l border-slate-100 relative z-10">
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50 pb-[68px]">

          {/* HEADER */}
          <header className="bg-white shrink-0 relative">
            {/* Top Header: Breadcrumbs */}
            <div className="px-3 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2 flex justify-between items-center gap-3 border-b border-slate-100/80">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 text-[11px] sm:text-sm font-bold text-slate-400">
                <button className="lg:hidden mr-0.5 sm:mr-2 text-slate-700 bg-slate-50 p-1.5 sm:p-2 rounded-full hover:bg-slate-100 transition-colors shrink-0" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight sm:gap-x-2">
                  <Link href="/" className="hover:text-indigo-600 transition-colors">Anasayfa</Link>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <Link href={`/${gradeSlug}`} className="hover:text-indigo-600 transition-colors">{gradeName}</Link>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-slate-700 truncate max-w-[180px] sm:max-w-[260px] lg:max-w-none">{lessonName}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-slate-900 truncate max-w-[220px] sm:max-w-[320px] lg:max-w-[440px]">{unitTitle}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-600 text-xs font-black shadow-sm">
                  <Trophy className="h-3.5 w-3.5" /> 1250 Puan
                </div>
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold shadow-sm cursor-pointer hover:bg-slate-700 transition-colors text-xs sm:text-sm">
                  M
                </div>
              </div>
            </div>


            {/* Weeks Scrollable - FIXED FOR WEB */}
            <div className="px-3 sm:px-6 lg:px-8 py-2 border-b border-slate-100 relative bg-white">
              <div
                ref={weeksContainerRef}
                className="weeks-scroll flex overflow-x-auto gap-1.5 sm:gap-2 pb-2 scroll-smooth"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  overscrollBehaviorX: 'contain',
                  overscrollBehaviorY: 'none'
                }}
              >
                <style>{`
                .weeks-scroll::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
                {weeks.map(w => (
                  <button
                    key={w.no}
                    data-week={w.no}
                    onClick={() => handleSelectWeek(w.no)}
                    className={`
                    flex-shrink-0 flex items-center justify-center h-8 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-bold transition-all whitespace-nowrap
                    ${w.isActive
                        ? 'bg-slate-800 text-white shadow-md shadow-slate-200 scale-105'
                        : w.isCompleted
                          ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100/80'
                      }
                  `}
                  >
                    {w.no}. Hafta
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* SPLIT PANEL: TOPICS & LESSON CONTENT */}
          <div className="flex min-h-0 flex-1 overflow-hidden relative bg-slate-50" id="lesson-content-area">

            {/* MIDDLE PANEL: TOPICS & OUTCOMES TABS */}
            <div className="w-[280px] lg:w-[320px] bg-white/80 backdrop-blur-sm border-r border-slate-200/80 flex flex-col shrink-0 hidden md:flex shadow-[5px_0_15px_-10px_rgba(0,0,0,0.03)]">
              <div className="p-4 lg:p-6 shrink-0 border-b border-slate-100">
                <div className="flex bg-slate-100 rounded-xl p-1">
                  <button
                    onClick={() => setActiveTab('konular')}
                    className={`flex-1 py-2 text-xs lg:text-sm font-bold rounded-lg transition-all ${activeTab === 'konular' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Konular
                  </button>
                  <button
                    onClick={() => setActiveTab('hedefler')}
                    className={`flex-1 py-2 text-xs lg:text-sm font-bold rounded-lg transition-all ${activeTab === 'hedefler' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Hedefler
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ scrollbarWidth: 'none' }}>
                {activeTab === 'konular' ? (
                  <div className="space-y-2 lg:space-y-3">
                    {contents.length > 0 ? contents.map((topic) => {
                      const isActive = selectedTopicId === topic.id;
                      return (
                        <button
                          key={topic.id}
                          onClick={() => setActiveTopicId(topic.id)}
                          className={`
                            w-full text-left p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-all duration-200 border group
                            ${isActive
                              ? 'bg-indigo-50/80 border-indigo-200 shadow-[0_8px_20px_-8px_rgba(79,70,229,0.12)] ring-2 ring-indigo-50/50'
                              : 'bg-white/50 border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-sm'}
                          `}
                        >
                          <div className="flex items-start gap-2 lg:gap-3">
                            <div className={`
                              mt-0.5 h-7 w-7 lg:h-8 lg:w-8 rounded-lg lg:rounded-xl flex items-center justify-center shrink-0 transition-colors text-xs lg:text-sm
                              ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}
                            `}>
                              <BookOpen className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-xs lg:text-sm font-extrabold leading-snug mb-1 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                                {topic.title}
                              </h4>
                              <div className="flex items-center gap-2 lg:gap-3 text-[8px] lg:text-[10px] font-black tracking-wide uppercase text-slate-400">
                                <span className="flex items-center gap-0.5 lg:gap-1 text-emerald-600">
                                  <Clock className="h-2.5 w-2.5 lg:h-3 lg:w-3" /> 15 dk
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 font-bold">
                        Bu hafta için konu bulunamadı.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {outcomes && outcomes.length > 0 ? (
                      outcomes.map((o, idx) => (
                        <div key={o.id || idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-sm font-medium text-slate-700 leading-relaxed">{o.description}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 font-bold">
                        Bu hafta için hedef bulunamadı.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* MAIN LESSON CONTENT - E-Kitap Style with Larger Height */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50" style={{ scrollbarWidth: 'thin' }}>
              <div className="max-w-4xl mx-auto p-3 sm:p-4 lg:p-5 min-h-full flex flex-col">

                {/* Mobile Topics Dropdown */}
                <div className="md:hidden mb-4 shrink-0">
                  <select
                    value={String(selectedTopicId || '')}
                    onChange={(e) => setActiveTopicId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {contents.map((topic) => (
                      <option key={topic.id} value={String(topic.id)}>
                        {topic.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* E-Book Content - Larger and more readable */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col">
                  {/* Content Header */}
                  <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-5 rounded-t-2xl border-b border-slate-200/60 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs font-black text-indigo-600 uppercase tracking-wider">Ders İçeriği</p>
                          <h2 className="text-sm sm:text-base lg:text-lg font-black text-slate-800 leading-tight">
                            {activeTopic?.title || 'Konu Seçin'}
                          </h2>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-400 font-bold">
                        <span className="hidden sm:inline">Hafta {week}</span>
                        <span className="bg-slate-100 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg">15 dk</span>
                      </div>
                    </div>
                  </div>

                  {/* Content Body - Removed inner scrollbar to let container grow */}
                  <div
                    ref={contentRef}
                    className="p-5 sm:p-8 lg:p-12"
                  >
                    {activeTopic ? (
                      <div className="prose prose-sm sm:prose lg:prose-lg max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-h2:text-xl sm:prose-h2:text-2xl lg:prose-h2:text-3xl prose-h3:text-lg sm:prose-h3:text-xl lg:prose-h3:text-2xl prose-p:text-base sm:prose-p:text-lg prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-slate-800 prose-ul:text-slate-700 prose-li:marker:text-indigo-400 prose-li:text-base sm:prose-li:text-lg">
                        {activeTopic.content ? (
                          <div dangerouslySetInnerHTML={{ __html: activeTopic.content }} />
                        ) : (
                          <div className="text-center py-12 sm:py-16 lg:py-20">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 sm:mb-6">
                              <PlayCircle className="h-10 w-10 sm:h-12 sm:w-12 text-slate-300" />
                            </div>
                            <h3 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-800 mb-2 sm:mb-3">İçerik Hazırlanıyor</h3>
                            <p className="text-sm sm:text-base lg:text-lg text-slate-500 font-medium">Bu konu için detaylı ders içeriği yakında eklenecektir.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 sm:py-16">
                        <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium text-base sm:text-lg">İçerik bulunamadı</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <footer className="absolute bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 px-3 py-2 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.45)] backdrop-blur-md sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sonraki Adım</div>
              <div className="truncate text-sm font-extrabold text-slate-800 sm:text-base">Hafta {week} Değerlendirme Testi</div>
            </div>
            <Link
              href={`/karisik-test?lesson_id=${lessonId}&week=${week}`}
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20 sm:px-6 sm:text-sm"
            >
              Teste Başla <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}