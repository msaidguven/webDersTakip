'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Icon } from '../src/components/icons';

// ============================================
// CONSTANTS
// ============================================
const CURRENT_WEEK = 19;

// ============================================
// TYPES
// ============================================
interface Outcome {
  id: number;
  description: string;
  topicTitle: string;
}

interface TopicContent {
  id: number;
  title: string;
  content: string;
  orderNo: number;
}

interface PageData {
  gradeName: string;
  lessonName: string;
  outcomes: Outcome[];
  contents: TopicContent[];
}

// ============================================
// SUPABASE CLIENT
// ============================================
function createSupabaseClient(): SupabaseClient | null {
  // Environment variables - must be set in Vercel dashboard
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  
  console.log('[Supabase] URL exists:', !!url);
  console.log('[Supabase] KEY exists:', !!key);
  
  if (!url) {
    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing');
    return null;
  }
  
  if (!key) {
    console.error('[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
    return null;
  }
  
  try {
    new URL(url);
    console.log('[Supabase] Client created successfully');
    return createClient(url, key);
  } catch (err) {
    console.error('[Supabase] Invalid URL:', url);
    return null;
  }
}

// ============================================
// DATA FETCHING
// ============================================
async function fetchWeekOutcomes(
  supabase: SupabaseClient,
  lessonId: number
): Promise<Outcome[]> {
  // 1. Get outcome IDs for current week
  const { data: weekOutcomes, error: weekError } = await supabase
    .from('outcome_weeks')
    .select('outcome_id')
    .lte('start_week', CURRENT_WEEK)
    .gte('end_week', CURRENT_WEEK);

  if (weekError) throw weekError;
  if (!weekOutcomes?.length) return [];

  // 2. Get outcomes with topic info
  const { data, error } = await supabase
    .from('outcomes')
    .select(`
      id,
      description,
      topics!inner (
        title,
        units!inner (lesson_id)
      )
    `)
    .in('id', weekOutcomes.map(w => w.outcome_id));

  if (error) throw error;

  // 3. Filter by lesson and format
  return (data || [])
    .filter((o: any) => o.topics?.units?.lesson_id === lessonId)
    .map((o: any) => ({
      id: o.id,
      description: o.description,
      topicTitle: o.topics?.title || ''
    }));
}

async function fetchWeekContents(
  supabase: SupabaseClient,
  lessonId: number
): Promise<TopicContent[]> {
  // 1. Get content IDs for current week
  const { data: weekContents, error: weekError } = await supabase
    .from('topic_content_weeks')
    .select('topic_content_id')
    .eq('curriculum_week', CURRENT_WEEK);

  if (weekError) throw weekError;
  if (!weekContents?.length) return [];

  // 2. Get contents with topic info
  const { data, error } = await supabase
    .from('topic_contents')
    .select(`
      id,
      title,
      content,
      order_no,
      topics!inner (
        units!inner (lesson_id)
      )
    `)
    .in('id', weekContents.map(w => w.topic_content_id))
    .order('order_no');

  if (error) throw error;

  // 3. Filter by lesson and format
  return (data || [])
    .filter((c: any) => c.topics?.units?.lesson_id === lessonId)
    .map((c: any) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      orderNo: c.order_no
    }));
}

async function fetchNames(
  supabase: SupabaseClient,
  gradeId: number,
  lessonId: number
): Promise<{ gradeName: string; lessonName: string }> {
  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).single(),
    supabase.from('lessons').select('name').eq('id', lessonId).single()
  ]);

  return {
    gradeName: grade?.name || '',
    lessonName: lesson?.name || ''
  };
}

// ============================================
// MAIN COMPONENT
// ============================================
function DersContent() {
  const searchParams = useSearchParams();
  const gradeId = searchParams.get('grade_id');
  const lessonId = searchParams.get('lesson_id');

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'outcomes' | 'content'>('outcomes');

  const loadData = useCallback(async () => {
    if (!gradeId || !lessonId) {
      setError('Sınıf veya ders bilgisi eksik');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError('Veritabanı bağlantısı kurulamadı');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [names, outcomes, contents] = await Promise.all([
        fetchNames(supabase, parseInt(gradeId), parseInt(lessonId)),
        fetchWeekOutcomes(supabase, parseInt(lessonId)),
        fetchWeekContents(supabase, parseInt(lessonId))
      ]);

      setData({
        ...names,
        outcomes,
        contents
      });
    } catch (err: any) {
      console.error('[DersContent] Error:', err);
      setError(err.message || 'Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Loading State
  if (loading) {
    return <LoadingScreen />;
  }

  // Error State
  if (error) {
    return <ErrorScreen error={error} />;
  }

  // Empty State
  if (!data) {
    return <EmptyScreen />;
  }

  return (
    <div className="min-h-screen bg-[#0f0f11]">
      <Navbar gradeName={data.gradeName} lessonName={data.lessonName} />
      
      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <Header 
            gradeName={data.gradeName}
            lessonName={data.lessonName}
            outcomeCount={data.outcomes.length}
          />

          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'outcomes' && <OutcomesList outcomes={data.outcomes} />}
          {activeTab === 'content' && <ContentList contents={data.contents} />}
        </div>
      </main>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================
function Navbar({ gradeName, lessonName }: { gradeName: string; lessonName: string }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-[#0f0f11]/95 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-xl font-bold text-white">E</span>
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">EduSmart</span>
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            ← Geri
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-zinc-400 text-sm hidden sm:block">
            {gradeName} → {lessonName}
          </span>
          <div className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700">
            {CURRENT_WEEK}. Hafta
          </div>
        </div>
      </div>
    </nav>
  );
}

function Header({ gradeName, lessonName, outcomeCount }: { 
  gradeName: string; 
  lessonName: string; 
  outcomeCount: number;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-6 sm:p-8 mb-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
        <span>🎓 {gradeName}</span>
        <span>→</span>
        <span>📚 {lessonName}</span>
        <span>→</span>
        <span>{CURRENT_WEEK}. Hafta</span>
      </div>
      
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
        {CURRENT_WEEK}. Hafta Konuları
      </h1>
      
      <div className="flex items-center gap-6 text-zinc-400">
        <span className="flex items-center gap-2">
          <Icon name="book" size={18} />
          {outcomeCount} Kazanım
        </span>
      </div>
    </div>
  );
}

function TabBar({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: 'outcomes' | 'content'; 
  onTabChange: (tab: 'outcomes' | 'content') => void;
}) {
  const tabs = [
    { id: 'outcomes' as const, label: '🎯 Kazanımlar', count: null },
    { id: 'content' as const, label: '📚 Konu Anlatımı', count: null },
  ];

  return (
    <div className="flex gap-2 mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
              : 'bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OutcomesList({ outcomes }: { outcomes: Outcome[] }) {
  if (outcomes.length === 0) {
    return (
      <EmptyState 
        icon="🎯"
        title="Kazanım Bulunamadı"
        message={`${CURRENT_WEEK}. hafta için bu derste kazanım eklenmemiş.`}
      />
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white mb-6">
        Bu Haftanın Kazanımları
      </h2>
      
      <div className="space-y-4">
        {outcomes.map((outcome, index) => (
          <div 
            key={outcome.id}
            className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
              {index + 1}
            </div>
            <div className="flex-1">
              <p className="text-zinc-200 leading-relaxed">{outcome.description}</p>
              {outcome.topicTitle && (
                <p className="text-zinc-500 text-sm mt-2">{outcome.topicTitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentList({ contents }: { contents: TopicContent[] }) {
  if (contents.length === 0) {
    return (
      <EmptyState 
        icon="📚"
        title="İçerik Bulunamadı"
        message={`${CURRENT_WEEK}. hafta için bu derste konu anlatımı eklenmemiş.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {contents.map((content) => (
        <article 
          key={content.id}
          className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold text-white mb-4">{content.title}</h2>
          <div 
            className="prose prose-invert prose-zinc max-w-none"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        </article>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-12 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-400">{message}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Yükleniyor...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">Bir Hata Oluştu</h1>
        <p className="text-zinc-400 mb-6">{error}</p>
        <Link 
          href="/"
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}

function EmptyScreen() {
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <p className="text-zinc-400">Veriler yüklenemedi</p>
    </div>
  );
}

// ============================================
// PAGE EXPORT
// ============================================
export default function DersPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DersContent />
    </Suspense>
  );
}
