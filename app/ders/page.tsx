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
// Hardcoded for testing - move to env vars in production
const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

console.log('[Supabase] Using URL:', SUPABASE_URL);
console.log('[Supabase] Key starts with:', SUPABASE_KEY.substring(0, 20));

function createSupabaseClient(): SupabaseClient | null {
  try {
    return createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch {
    console.error('[Supabase] Failed to create client');
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
      <style dangerouslySetInnerHTML={{ __html: topicContentStyles.replace(/<style>|<\/style>/g, '') }} />
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
            className="topic-content"
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

// ============================================
// TOPIC CONTENT STYLES
// ============================================
const topicContentStyles = `
  <style>
  .topic-content {
    color: #d4d4d8;
    line-height: 1.75;
  }
  
  .topic-content h1 {
    font-size: 1.875rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 2rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #3f3f46;
  }
  
  .topic-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #ffffff;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  
  .topic-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #818cf8;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }
  
  .topic-content h4 {
    font-size: 1.125rem;
    font-weight: 500;
    color: #e4e4e7;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .topic-content p {
    margin-bottom: 1rem;
    color: #d4d4d8;
  }
  
  .topic-content ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .topic-content ol {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .topic-content li {
    margin-bottom: 0.5rem;
    color: #d4d4d8;
  }
  
  .topic-content li::marker {
    color: #818cf8;
  }
  
  .topic-content strong {
    color: #ffffff;
    font-weight: 600;
  }
  
  .topic-content em {
    color: #a5b4fc;
    font-style: italic;
  }
  
  .topic-content blockquote {
    border-left: 4px solid #6366f1;
    padding-left: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    margin: 1rem 0;
    background: rgba(39, 39, 42, 0.5);
    border-radius: 0 0.5rem 0.5rem 0;
    font-style: italic;
    color: #a1a1aa;
  }
  
  .topic-content code {
    background: #27272a;
    color: #34d399;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
  }
  
  .topic-content pre {
    background: #18181b;
    border: 1px solid #27272a;
    padding: 1rem;
    border-radius: 0.75rem;
    margin: 1rem 0;
    overflow-x: auto;
  }
  
  .topic-content pre code {
    background: transparent;
    padding: 0;
    font-size: 0.875rem;
  }
  
  .topic-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
  }
  
  .topic-content th {
    background: #27272a;
    color: #ffffff;
    font-weight: 600;
    padding: 0.75rem;
    border: 1px solid #3f3f46;
    text-align: left;
  }
  
  .topic-content td {
    padding: 0.75rem;
    border: 1px solid #27272a;
    color: #d4d4d8;
  }
  
  .topic-content tr:nth-child(even) {
    background: rgba(39, 39, 42, 0.3);
  }
  
  .topic-content a {
    color: #818cf8;
    text-decoration: underline;
    transition: color 0.2s;
  }
  
  .topic-content a:hover {
    color: #a5b4fc;
  }
  
  .topic-content img {
    max-width: 100%;
    border-radius: 0.75rem;
    margin: 1rem 0;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
  }
  
  .topic-content hr {
    border: none;
    border-top: 1px solid #27272a;
    margin: 2rem 0;
  }
  
  .topic-content .formula {
    background: rgba(39, 39, 42, 0.8);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    display: inline-block;
    font-size: 1.125rem;
    font-family: ui-monospace, monospace;
    margin: 0.5rem 0;
  }
  
  .topic-content .highlight {
    background: rgba(250, 204, 21, 0.2);
    color: #fef08a;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }
  
  .topic-content .note {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 1rem;
    border-radius: 0.75rem;
    margin: 1rem 0;
  }
  
  .topic-content .note::before {
    content: "💡 Not: ";
    font-weight: 600;
    color: #60a5fa;
  }
  
  .topic-content .warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 1rem;
    border-radius: 0.75rem;
    margin: 1rem 0;
  }
  
  .topic-content .warning::before {
    content: "⚠️ Uyarı: ";
    font-weight: 600;
    color: #fbbf24;
  }
  
  .topic-content .tip {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 1rem;
    border-radius: 0.75rem;
    margin: 1rem 0;
  }
  
  .topic-content .tip::before {
    content: "✅ İpucu: ";
    font-weight: 600;
    color: #34d399;
  }
  </style>
`;
