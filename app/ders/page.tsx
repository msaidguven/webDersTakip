'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Icon } from '../src/components/icons';

const CURRENT_WEEK = 19;

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

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

function createSupabaseClient(): SupabaseClient | null {
  try {
    return createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch {
    return null;
  }
}

async function fetchWeekOutcomes(supabase: SupabaseClient, lessonId: number): Promise<Outcome[]> {
  const { data: weekOutcomes, error: weekError } = await supabase
    .from('outcome_weeks')
    .select('outcome_id')
    .lte('start_week', CURRENT_WEEK)
    .gte('end_week', CURRENT_WEEK);

  if (weekError) throw weekError;
  if (!weekOutcomes?.length) return [];

  const { data, error } = await supabase
    .from('outcomes')
    .select('id, description, topics!inner(title, units!inner(lesson_id))')
    .in('id', weekOutcomes.map(w => w.outcome_id));

  if (error) throw error;

  return (data || [])
    .filter((o: any) => o.topics?.units?.lesson_id === lessonId)
    .map((o: any) => ({
      id: o.id,
      description: o.description,
      topicTitle: o.topics?.title || ''
    }));
}

async function fetchWeekContents(supabase: SupabaseClient, lessonId: number): Promise<TopicContent[]> {
  const { data: weekContents, error: weekError } = await supabase
    .from('topic_content_weeks')
    .select('topic_content_id')
    .eq('curriculum_week', CURRENT_WEEK);

  if (weekError) throw weekError;
  if (!weekContents?.length) return [];

  const { data, error } = await supabase
    .from('topic_contents')
    .select('id, title, content, order_no, topics!inner(units!inner(lesson_id))')
    .in('id', weekContents.map(w => w.topic_content_id))
    .order('order_no');

  if (error) throw error;

  return (data || [])
    .filter((c: any) => c.topics?.units?.lesson_id === lessonId)
    .map((c: any) => ({
      id: c.id,
      title: c.title,
      content: c.content,
      orderNo: c.order_no
    }));
}

async function fetchNames(supabase: SupabaseClient, gradeId: number, lessonId: number) {
  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).single(),
    supabase.from('lessons').select('name').eq('id', lessonId).single()
  ]);

  return {
    gradeName: grade?.name || '',
    lessonName: lesson?.name || ''
  };
}

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
      setError('Sinif veya ders bilgisi eksik');
      setLoading(false);
      return;
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError('Veritabani baglantisi kurulamadi');
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

      setData({ ...names, outcomes, contents });
    } catch (err: any) {
      setError(err.message || 'Veriler yuklenirken bir hata olustu');
    } finally {
      setLoading(false);
    }
  }, [gradeId, lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Yukleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Hata</h1>
          <p className="text-zinc-400 mb-6">{error}</p>
          <Link href="/" className="px-6 py-3 rounded-xl bg-indigo-500 text-white">Ana Sayfaya Don</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <p className="text-zinc-400">Veriler yuklenemedi</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f11]">
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
            <Link href="/" className="text-zinc-400 hover:text-white">{'<-'} Geri</Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-sm hidden sm:block">{data.gradeName} {'->'} {data.lessonName}</span>
            <div className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700">{CURRENT_WEEK}. Hafta</div>
          </div>
        </div>
      </nav>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-6 sm:p-8 mb-8">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
              <span>🎓 {data.gradeName}</span>
              <span>{'->'}</span>
              <span>📚 {data.lessonName}</span>
              <span>{'->'}</span>
              <span>{CURRENT_WEEK}. Hafta</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">{CURRENT_WEEK}. Hafta Konulari</h1>
            <div className="flex items-center gap-6 text-zinc-400">
              <span className="flex items-center gap-2">
                <Icon name="book" size={18} />
                {data.outcomes.length} Kazanim
              </span>
            </div>
          </div>

          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveTab('outcomes')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'outcomes' ? 'bg-indigo-500 text-white' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'}`}
            >
              🎯 Kazanimlar
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'content' ? 'bg-indigo-500 text-white' : 'bg-zinc-900/50 text-zinc-400 hover:text-white'}`}
            >
              📚 Konu Anlatimi
            </button>
          </div>

          {activeTab === 'outcomes' && (
            <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Bu Haftanin Kazanimlari</h2>
              {data.outcomes.length === 0 ? (
                <p className="text-zinc-400">Bu hafta icin kazanim bulunmuyor.</p>
              ) : (
                <div className="space-y-4">
                  {data.outcomes.map((outcome, index) => (
                    <div key={outcome.id} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">{index + 1}</div>
                      <div className="flex-1">
                        <p className="text-zinc-200">{outcome.description}</p>
                        {outcome.topicTitle && <p className="text-zinc-500 text-sm mt-2">{outcome.topicTitle}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
              {data.contents.length === 0 ? (
                <p className="text-zinc-400">Bu hafta icin icerik bulunmuyor.</p>
              ) : (
                <>
                  {data.contents.map((content) => (
                    <article key={content.id} className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
                      <h2 className="text-xl font-semibold text-white mb-4">{content.title}</h2>
                      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content.content }} />
                    </article>
                  ))}
                  
                  {/* Test Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-6 text-center">
                      <div className="text-4xl mb-4">📝</div>
                      <h3 className="text-xl font-bold text-white mb-2">Haftalik Test</h3>
                      <p className="text-zinc-400 mb-4">Coktan secmeli sorular</p>
                      <Link href={`/haftalik-test?unit_id=1&week=${CURRENT_WEEK}`} className="inline-block px-6 py-2 rounded-xl bg-amber-500 text-white">Teste Basla</Link>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 p-6 text-center">
                      <div className="text-4xl mb-4">🔗</div>
                      <h3 className="text-xl font-bold text-white mb-2">Eslestirme</h3>
                      <p className="text-zinc-400 mb-4">Surukle birak eslestirme</p>
                      <Link href={`/eslestirme?unit_id=1&week=${CURRENT_WEEK}`} className="inline-block px-6 py-2 rounded-xl bg-purple-500 text-white">Eslestirme Yap</Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <DersContent />
    </Suspense>
  );
}
