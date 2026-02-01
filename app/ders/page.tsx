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

  // 19. hafta için kazanımları çek
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
          return;
        }
        
        const { data, error } = await supabase.rpc('get_week_view_web', {
          p_lesson_id: parseInt(lessonId),
          p_grade_id: parseInt(gradeId),
          p_week_number: 19
        });
        
        console.log('[fetchOutcomes] Response:', { data, error });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setOutcomes(data);
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
          p_week_number: 19
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
  }, [gradeId, lessonId]);

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
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl font-bold text-white">E</span>
              </div>
              <span className="text-xl font-bold text-white hidden sm:block">EduSmart</span>
            </Link>
            <div className="h-6 w-px bg-white/10 mx-2" />
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
              ← Geri
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">19. Hafta</span>
            <button className="px-4 py-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
              <Icon name="bookmark" size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-[120px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-8 mb-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-transparent rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4 flex-wrap">
                <span className="flex items-center gap-1">{lesson.sinif.icon} {lesson.sinif.name}</span>
                <span>→</span>
                <span className="flex items-center gap-1">{lesson.ders.icon} {lesson.ders.name}</span>
                <span>→</span>
                <span>19. Hafta</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                {outcomes.length > 0 ? outcomes[0].unit_title : lesson.unite.name}
              </h1>
              <p className="text-zinc-400 text-lg max-w-2xl">
                {outcomes.length > 0 ? `${outcomes.length} kazanım listeleniyor` : lesson.konu.description}
              </p>

              <div className="flex gap-6 mt-6">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Icon name="book" size={18} />
                  <span>{outcomes.length} Kazanım</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Icon name="clock" size={18} />
                  <span>19. Hafta</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-all
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {activeTab === 'kazanimlar' && (
                <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8">
                  <h3 className="text-xl font-semibold text-white mb-6">🎯 Bu Haftanın Kazanımları (19. Hafta)</h3>
                  
                  {isLoadingOutcomes ? (
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex-shrink-0" />
                          <div className="flex-1 h-6 bg-zinc-700 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : outcomesError ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                      Hata: {outcomesError}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {outcomes.map((outcome, index) => (
                        <div 
                          key={outcome.id}
                          className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="text-zinc-300">{outcome.description}</p>
                            <p className="text-sm text-zinc-500 mt-1">{outcome.topic_title}</p>
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
                    <div className="space-y-6">
                      {[1, 2].map((i) => (
                        <div key={i} className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8 animate-pulse">
                          <div className="h-8 bg-zinc-800 rounded mb-4 w-1/3" />
                          <div className="space-y-2">
                            <div className="h-4 bg-zinc-800 rounded w-full" />
                            <div className="h-4 bg-zinc-800 rounded w-full" />
                            <div className="h-4 bg-zinc-800 rounded w-2/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : contentsError ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                      Hata: {contentsError}
                    </div>
                  ) : topicContents.length === 0 ? (
                    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8 text-center">
                      <p className="text-zinc-400">Bu hafta için konu içeriği bulunmuyor.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {topicContents.map((content) => (
                        <div key={content.id} className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8">
                          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
                            <span>{content.unit_title}</span>
                            <span>→</span>
                            <span>{content.topic_title}</span>
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-4">{content.title}</h3>
                          <div 
                            className="prose prose-invert prose-zinc max-w-none"
                            dangerouslySetInnerHTML={{ __html: content.content }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'quiz' && (
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 p-8">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-4xl mx-auto mb-4">❓</div>
                    <h3 className="text-2xl font-bold text-white mb-2">{lesson.quiz.name}</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center p-4 rounded-xl bg-zinc-900/50">
                      <p className="text-2xl font-bold text-white">{lesson.quiz.questionCount}</p>
                      <p className="text-sm text-zinc-500">Soru</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-zinc-900/50">
                      <p className="text-2xl font-bold text-white">{lesson.quiz.estimatedTime}</p>
                      <p className="text-sm text-zinc-500">Dakika</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-zinc-900/50">
                      <p className="text-2xl font-bold text-white">{lesson.quiz.difficulty}</p>
                      <p className="text-sm text-zinc-500">Zorluk</p>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                    Teste Başla →
                  </button>
                </div>
              )}

              {activeTab === 'test' && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-8">
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-4xl mx-auto mb-4">📝</div>
                    <h3 className="text-2xl font-bold text-white mb-2">{lesson.haftalikTest.name}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="text-center p-4 rounded-xl bg-zinc-900/50">
                      <p className="text-2xl font-bold text-white">{lesson.haftalikTest.questionCount}</p>
                      <p className="text-sm text-zinc-500">Soru</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-zinc-900/50">
                      <p className="text-2xl font-bold text-white">{lesson.haftalikTest.estimatedTime}</p>
                      <p className="text-sm text-zinc-500">Dakika</p>
                    </div>
                  </div>
                  <button className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all">
                    Teste Başla →
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
                <h4 className="text-white font-semibold mb-4">📊 İlerleme (19. Hafta)</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Kazanımlar</span>
                    <span className="text-emerald-400">{outcomes.length} adet</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Konu Anlatımı</span>
                    <span className="text-zinc-500">Başlanmadı</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-white/5 p-6">
                <h4 className="text-white font-semibold mb-2">💡 Yardım mı lazım?</h4>
                <p className="text-zinc-400 text-sm mb-4">Bu konuyu anlamakta zorlanıyorsan AI asistanımızdan yardım alabilirsin.</p>
                <button className="w-full py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors">
                  🤖 AI Asistana Sor
                </button>
              </div>
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Yükleniyor...</p>
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
