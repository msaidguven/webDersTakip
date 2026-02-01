'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Icon } from '../src/components/icons';

// Supabase client oluştur
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^['"]+/, '').replace(/['";]+$/, '').trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.replace(/^['"]+/, '').replace(/['";]+$/, '').trim();
  
  if (!supabaseUrl || !supabaseKey) return null;
  
  try {
    new URL(supabaseUrl);
    return createClient(supabaseUrl, supabaseKey);
  } catch {
    return null;
  }
}

// Mock Data - Sonra DB'den çekilecek
const mockLessonContent = {
  id: '1',
  sinif: { id: '8', name: '8. Sınıf', icon: '🎯' },
  ders: { id: '8-mat', name: 'Matematik', icon: '🔢', color: 'from-indigo-500 to-purple-500' },
  unite: { id: '1', name: '1. Ünite: Sayılar ve İşlemler', order: 1 },
  konu: {
    id: '1-1',
    name: 'Tam Sayılarda İşlemler',
    description: 'Negatif ve pozitif tam sayılarla toplama, çıkarma, çarpma ve bölme işlemleri',
    estimatedTime: 45,
  },
  kazanimlar: [
    'Tam sayıları sıralayabilir.',
    'Tam sayılarda toplama ve çıkarma işlemi yapabilir.',
    'Tam sayılarda çarpma ve bölme işlemi yapabilir.',
    'Tam sayılarla ilgili problemleri çözebilir.',
  ],
  icerik: {
    video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    metin: `## Tam Sayılar Nedir?

Tam sayılar, negatif (-), pozitif (+) ve sıfır (0) değerlerini içeren sayı kümesidir.

### Örnekler:
- Pozitif tam sayılar: 1, 2, 3, 4, 5, ...
- Negatif tam sayılar: -1, -2, -3, -4, -5, ...
- Sıfır: 0 (nötr)

## Toplama İşlemi

Aynı işaretli sayılar toplanırken, mutlak değerler toplanır ve ortak işaret yazılır.

**Örnek:** (-3) + (-5) = -8

Farklı işaretli sayılar toplanırken, mutlak değerler çıkarılır ve büyük olanın işareti yazılır.

**Örnek:** (-7) + 4 = -3`,
    dosyalar: [
      { name: 'Tam_Sayilar_Konu_Anilatimi.pdf', size: '2.4 MB', type: 'pdf' },
      { name: 'Calisma_Kagidi.docx', size: '156 KB', type: 'doc' },
    ],
  },
  quiz: {
    id: 'quiz-1',
    name: 'Konu Testi: Tam Sayılarda İşlemler',
    questionCount: 10,
    estimatedTime: 15,
    difficulty: 'Orta',
  },
  haftalikTest: {
    id: 'test-1',
    name: 'Haftalık Değerlendirme #3',
    questionCount: 20,
    estimatedTime: 30,
    deadline: '2026-02-07 23:59',
  },
};

type TabType = 'kazanimlar' | 'icerik' | 'quiz' | 'test';

interface Outcome {
  id: number;
  topic_id: number;
  description: string;
  unit_title: string;
  topic_title: string;
}

interface TopicContent {
  id: number;
  topic_id: number;
  title: string;
  content: string;
  order_no: number;
  topic_title: string;
  unit_title: string;
}

// Ana içerik komponenti
function DersContent() {
  const searchParams = useSearchParams();
  const gradeId = searchParams.get('grade_id');
  const lessonId = searchParams.get('lesson_id');
  
  const [activeTab, setActiveTab] = useState<TabType>('kazanimlar');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [isLoadingOutcomes, setIsLoadingOutcomes] = useState(true);
  const [outcomesError, setOutcomesError] = useState<string | null>(null);
  const [topicContents, setTopicContents] = useState<TopicContent[]>([]);
  const [isLoadingContents, setIsLoadingContents] = useState(true);
  const [contentsError, setContentsError] = useState<string | null>(null);
  const [weekInfo, setWeekInfo] = useState<{grade_name?: string; lesson_name?: string; unit_title?: string} | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [selectedWeek] = useState<number>(19); // Şimdilik statik 19. hafta

  // Sınıf ve ders bilgilerini çek
  useEffect(() => {
    async function fetchGradeAndLesson() {
      if (!gradeId || !lessonId) return;
      
      try {
        const supabase = createSupabaseClient();
        if (!supabase) return;
        
        // Sınıf bilgisini çek
        const { data: gradeData } = await supabase
          .from('grades')
          .select('name')
          .eq('id', parseInt(gradeId))
          .single();
        
        // Ders bilgisini çek
        const { data: lessonData } = await supabase
          .from('lessons')
          .select('name')
          .eq('id', parseInt(lessonId))
          .single();
        
        setWeekInfo(prev => ({
          ...prev,
          grade_name: gradeData?.name,
          lesson_name: lessonData?.name,
        }));
      } catch (err) {
        console.error('[fetchGradeAndLesson] Error:', err);
      }
    }
    
    fetchGradeAndLesson();
  }, [gradeId, lessonId]);

  // unit_id'yi seçilen haftaya göre çek
  // 19. hafta için üniteyi çek (unit_grades join units)
  useEffect(() => {
    async function fetchUnitId() {
      if (!gradeId || !lessonId) return;
      
      try {
        const supabase = createSupabaseClient();
        if (!supabase) {
          setUnitId(null);
          return;
        }
        
        // 1. Önce bu grade+ders için tüm unit_grades kayıtlarını çek
        const { data: allGrades, error: gradesError } = await supabase
          .from('unit_grades')
          .select(`
            unit_id,
            start_week,
            end_week,
            units:unit_id (id, title, lesson_id)
          `)
          .eq('grade_id', parseInt(gradeId));
        
        if (gradesError) throw gradesError;
        
        // 2. JavaScript'te filtrele: 19. hafta içinde mi ve ders eşleşiyor mu?
        const matching = allGrades?.find((ug: any) => {
          const weekMatch = selectedWeek >= (ug.start_week || 0) && selectedWeek <= (ug.end_week || 999);
          const lessonMatch = ug.units?.lesson_id === parseInt(lessonId);
          return weekMatch && lessonMatch;
        });
        
        if (matching && matching.units) {
          setUnitId(matching.unit_id);
          setWeekInfo(prev => ({ ...prev, unit_title: matching.units.title }));
        } else {
          setUnitId(null);
          setWeekInfo(prev => ({ ...prev, unit_title: undefined }));
        }
      } catch (err) {
        console.error('[fetchUnitId] Error:', err);
        setUnitId(null);
      }
    }
    
    fetchUnitId();
  }, [gradeId, lessonId]);

  // Seçilen hafta için kazanımları çek
  useEffect(() => {
    async function fetchOutcomes() {
      if (!gradeId || !lessonId) {
        console.log('[fetchOutcomes] Missing gradeId or lessonId');
        setIsLoadingOutcomes(false);
        return;
      }

      console.log('[fetchOutcomes] Fetching for grade:', gradeId, 'lesson:', lessonId, 'week: 19');
      
      try {
        setIsLoadingOutcomes(true);
        setOutcomesError(null);
        
        const supabase = createSupabaseClient();
        
        if (!supabase) {
          console.log('[fetchOutcomes] Supabase not configured, using mock data');
          setOutcomes(mockLessonContent.kazanimlar.map((desc, index) => ({
            id: index + 1,
            topic_id: 1,
            description: desc,
            unit_title: mockLessonContent.unite.name,
            topic_title: mockLessonContent.konu.name,
          })));
          setWeekInfo(prev => ({
            ...prev,
            grade_name: mockLessonContent.sinif.name,
            lesson_name: mockLessonContent.ders.name,
            unit_title: mockLessonContent.unite.name,
          }));
          return;
        }
        
        const { data, error } = await supabase.rpc('get_week_view_web', {
          p_lesson_id: parseInt(lessonId),
          p_grade_id: parseInt(gradeId),
          p_week_number: selectedWeek
        });
        
        console.log('[fetchOutcomes] Response:', { data, error });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setOutcomes(data);
          // Sadece ünite bilgisini al (sınıf/ders ayrı çekiliyor)
          setWeekInfo(prev => ({
            ...prev,
            unit_title: data[0].unit_title,
          }));
        } else {
          setOutcomes(mockLessonContent.kazanimlar.map((desc, index) => ({
            id: index + 1,
            topic_id: 1,
            description: desc,
            unit_title: mockLessonContent.unite.name,
            topic_title: mockLessonContent.konu.name,
          })));
        }
      } catch (err: any) {
        console.error('[fetchOutcomes] Error:', err);
        setOutcomesError(err.message);
        setOutcomes(mockLessonContent.kazanimlar.map((desc, index) => ({
          id: index + 1,
          topic_id: 1,
          description: desc,
          unit_title: mockLessonContent.unite.name,
          topic_title: mockLessonContent.konu.name,
        })));
        setWeekInfo(prev => ({
          ...prev,
          grade_name: mockLessonContent.sinif.name,
          lesson_name: mockLessonContent.ders.name,
          unit_title: mockLessonContent.unite.name,
        }));
      } finally {
        setIsLoadingOutcomes(false);
      }
    }
    
    fetchOutcomes();
    
    // Topic contents çek
    async function fetchTopicContents() {
      if (!gradeId || !lessonId) {
        setIsLoadingContents(false);
        return;
      }
      
      try {
        setIsLoadingContents(true);
        setContentsError(null);
        
        const supabase = createSupabaseClient();
        
        if (!supabase) {
          setTopicContents([]);
          return;
        }
        
        const { data, error } = await supabase.rpc('web_get_topic_contents_for_week', {
          p_lesson_id: parseInt(lessonId),
          p_grade_id: parseInt(gradeId),
          p_week_number: selectedWeek
        });
        
        if (error) throw error;
        
        setTopicContents(data || []);
      } catch (err: any) {
        console.error('[fetchTopicContents] Error:', err);
        setContentsError(err.message);
        setTopicContents([]);
      } finally {
        setIsLoadingContents(false);
      }
    }
    
    fetchTopicContents();
  }, [gradeId, lessonId, selectedWeek]);

  const lesson = mockLessonContent;

  const tabs = [
    { id: 'kazanimlar' as TabType, label: '🎯 Kazanımlar', icon: 'check-circle' },
    { id: 'icerik' as TabType, label: '📚 Ders İçeriği', icon: 'book' },
    { id: 'quiz' as TabType, label: '❓ Konu Testi', icon: 'check-circle' },
    { id: 'test' as TabType, label: '📝 Haftalık Test', icon: 'check-circle' },
  ];

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-background/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-lg sm:text-xl font-bold text-white">E</span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-white hidden sm:block">EduSmart</span>
            </Link>
            <div className="h-6 w-px bg-white/10 mx-1 sm:mx-2" />
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors text-sm sm:text-base">
              ← Geri
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Hafta 19 (Statik) */}
            <div className="bg-zinc-800 text-white text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-2 border border-zinc-700">
              19. Hafta
            </div>
            <button className="p-2 sm:px-4 sm:py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
              <Icon name="bookmark" size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-[100px] sm:pt-[120px] pb-16 sm:pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-5 sm:p-8 mb-6 sm:mb-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-3xl" />
            
            <div className="relative">
              {/* Hiyerarşi: Sınıf → Ders → Ünite */}
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-zinc-500 mb-3 sm:mb-4 flex-wrap">
                <span className="flex items-center gap-1">🎓 {weekInfo?.grade_name || lesson.sinif.name}</span>
                <span className="hidden sm:inline">→</span>
                <span className="sm:hidden">›</span>
                <span className="flex items-center gap-1">📚 {weekInfo?.lesson_name || lesson.ders.name}</span>
                <span className="hidden sm:inline">→</span>
                <span className="sm:hidden">›</span>
                <span>{selectedWeek}. Hafta</span>
              </div>

              {/* Ünite Başlığı - BÜYÜK */}
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
                {weekInfo?.unit_title || lesson.unite.name}
              </h1>
              
              {/* Konu Başlıkları - Ünite altında */}
              {outcomes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                  {Array.from(new Set(outcomes.map(o => o.topic_title))).map((topicTitle, idx) => (
                    <span key={idx} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs sm:text-sm">
                      {topicTitle}
                    </span>
                  ))}
                </div>
              )}
              
              <p className="text-zinc-400 text-sm sm:text-base lg:text-lg max-w-2xl">
                {outcomes.length > 0 ? `${outcomes.length} kazanım listeleniyor` : lesson.konu.description}
              </p>

              <div className="flex gap-4 sm:gap-6 mt-4 sm:mt-6">
                <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-sm sm:text-base">
                  <Icon name="book" size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span>{outcomes.length} Kazanım</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-zinc-400 text-sm sm:text-base">
                  <Icon name="clock" size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span>{selectedWeek}. Hafta</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium whitespace-nowrap transition-all text-sm sm:text-base
                  ${activeTab === tab.id
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              {activeTab === 'kazanimlar' && (
                <div className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-5 sm:p-8">
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6">🎯 Bu Haftanın Kazanımları ({selectedWeek}. Hafta)</h3>
                  
                  {isLoadingOutcomes ? (
                    <div className="space-y-3 sm:space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-800/30 animate-pulse">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-700 flex-shrink-0" />
                          <div className="flex-1 h-5 sm:h-6 bg-zinc-700 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : outcomesError ? (
                    <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm sm:text-base">
                      Hata: {outcomesError}
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      {outcomes.map((outcome, index) => (
                        <div 
                          key={outcome.id}
                          className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-xs sm:text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-300 text-sm sm:text-base">{outcome.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'icerik' && (
                <>
                  {isLoadingContents ? (
                    <div className="space-y-4 sm:space-y-6">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-5 sm:p-8 animate-pulse">
                          <div className="h-6 sm:h-8 bg-zinc-800 rounded mb-3 sm:mb-4 w-1/2 sm:w-1/3" />
                          <div className="space-y-2">
                            <div className="h-3 sm:h-4 bg-zinc-800 rounded w-full" />
                            <div className="h-3 sm:h-4 bg-zinc-800 rounded w-full" />
                            <div className="h-3 sm:h-4 bg-zinc-800 rounded w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : contentsError ? (
                    <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm sm:text-base">
                      Hata: {contentsError}
                    </div>
                  ) : topicContents.length === 0 ? (
                    <div className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8 text-center">
                      <p className="text-zinc-400 text-sm sm:text-base">Bu hafta için konu içeriği bulunmuyor.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 sm:space-y-6">
                      {topicContents.map((content) => (
                        <div key={content.id} className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-5 sm:p-8">
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-zinc-500 mb-2 flex-wrap">
                            <span className="truncate max-w-[120px] sm:max-w-none">{content.unit_title}</span>
                            <span className="hidden sm:inline">→</span>
                            <span className="sm:hidden">›</span>
                            <span className="truncate max-w-[120px] sm:max-w-none">{content.topic_title}</span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">{content.title}</h3>
                          <div 
                            className="prose prose-invert prose-zinc max-w-none prose-sm sm:prose-base [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-bold [&_em]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mb-2 [&_a]:text-indigo-400 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-zinc-800 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-zinc-700 [&_th]:p-2 [&_td]:border [&_td]:border-zinc-700 [&_td]:p-2 [&_img]:max-w-full [&_img]:rounded-lg"
                            dangerouslySetInnerHTML={{ __html: content.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'") }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'quiz' && (
                <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 p-5 sm:p-8">
                  <div className="text-center mb-6 sm:mb-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-3 sm:mb-4">❓</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{lesson.quiz.name}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/50">
                      <p className="text-xl sm:text-2xl font-bold text-white">{lesson.quiz.questionCount}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">Soru</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/50">
                      <p className="text-xl sm:text-2xl font-bold text-white">{lesson.quiz.estimatedTime}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">Dakika</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/50">
                      <p className="text-xl sm:text-2xl font-bold text-white">{lesson.quiz.difficulty}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">Zorluk</p>
                    </div>
                  </div>
                  <button className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow-lg transition-all text-sm sm:text-base">
                    Teste Başla →
                  </button>
                </div>
              )}

              {activeTab === 'test' && (
                <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-5 sm:p-8">
                  <div className="text-center mb-6 sm:mb-8">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-3 sm:mb-4">📝</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{lesson.haftalikTest.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6 sm:mb-8">
                    <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/50">
                      <p className="text-xl sm:text-2xl font-bold text-white">{lesson.haftalikTest.questionCount}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">Soru</p>
                    </div>
                    <div className="text-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-zinc-900/50">
                      <p className="text-xl sm:text-2xl font-bold text-white">{lesson.haftalikTest.estimatedTime}</p>
                      <p className="text-xs sm:text-sm text-zinc-500">Dakika</p>
                    </div>
                  </div>
                  {unitId ? (
                    <Link 
                      href={`/haftalik-test?unit_id=${unitId}&week=${selectedWeek}`}
                      className="block w-full py-3 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg sm:rounded-xl hover:shadow-lg transition-all text-sm sm:text-base text-center"
                    >
                      Teste Başla →
                    </Link>
                  ) : (
                    <button 
                      disabled
                      className="w-full py-3 sm:py-4 bg-zinc-700 text-zinc-400 font-semibold rounded-lg sm:rounded-xl cursor-not-allowed text-sm sm:text-base"
                    >
                      19. hafta için içerik bulunamadı
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6 order-last lg:order-last">
              <div className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-4 sm:p-6">
                <h4 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">📊 İlerleme ({selectedWeek}. Hafta)</h4>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-zinc-500">Kazanımlar</span>
                    <span className="text-emerald-400">{outcomes.length} adet</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-zinc-500">Konu Anlatımı</span>
                    <span className="text-zinc-500">Başlanmadı</span>
                  </div>
                </div>
              </div>

              {/* AI Asistan - Aktif değil, mobilde en altta */}
              {/*
              <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-white/5 p-4 sm:p-6">
                <h4 className="text-white font-semibold mb-2 text-sm sm:text-base">💡 Yardım mı lazım?</h4>
                <p className="text-zinc-400 text-xs sm:text-sm mb-3 sm:mb-4">Bu konuyu anlamakta zorlanıyorsan AI asistanımızdan yardım alabilirsin.</p>
                <button className="w-full py-2.5 sm:py-3 bg-white/10 text-white rounded-lg sm:rounded-xl hover:bg-white/20 transition-colors text-sm sm:text-base">
                  🤖 AI Asistana Sor
                </button>
              </div>
              */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4" />
        <p className="text-zinc-400 text-sm sm:text-base">Yükleniyor...</p>
      </div>
    </div>
  );
}

// Ana sayfa komponenti
export default function DersPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DersContent />
    </Suspense>
  );
}
