'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Icon } from '../src/components/icons';

const WEEK = 19;

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

interface Outcome {
  id: number;
  description: string;
  topic_title: string;
}

interface TopicContent {
  id: number;
  title: string;
  content: string;
}

function DersContent() {
  const searchParams = useSearchParams();
  const gradeId = searchParams.get('grade_id');
  const lessonId = searchParams.get('lesson_id');
  
  const [activeTab, setActiveTab] = useState<'kazanimlar' | 'icerik'>('kazanimlar');
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [contents, setContents] = useState<TopicContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeName, setGradeName] = useState('');
  const [lessonName, setLessonName] = useState('');

  useEffect(() => {
    if (!gradeId || !lessonId) return;
    
    const supabase = createSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Kazanımları çek
    async function loadOutcomes() {
      const { data: weeks } = await supabase
        .from('outcome_weeks')
        .select('outcome_id')
        .lte('start_week', WEEK)
        .gte('end_week', WEEK);
      
      if (!weeks?.length) {
        setOutcomes([]);
        return;
      }

      const { data } = await supabase
        .from('outcomes')
        .select('id, description, topics!inner(title, units!inner(lesson_id))')
        .in('id', weeks.map(w => w.outcome_id));

      const filtered = data?.filter((o: any) => o.topics?.units?.lesson_id === parseInt(lessonId)) || [];
      
      setOutcomes(filtered.map((o: any) => ({
        id: o.id,
        description: o.description,
        topic_title: o.topics?.title || ''
      })));
    }

    // Konu içeriklerini çek
    async function loadContents() {
      const { data: weeks } = await supabase
        .from('topic_content_weeks')
        .select('topic_content_id')
        .eq('curriculum_week', WEEK);
      
      if (!weeks?.length) {
        setContents([]);
        return;
      }

      const { data } = await supabase
        .from('topic_contents')
        .select('id, title, content, topics!inner(units!inner(lesson_id))')
        .in('id', weeks.map(w => w.topic_content_id))
        .order('order_no');

      const filtered = data?.filter((c: any) => c.topics?.units?.lesson_id === parseInt(lessonId)) || [];
      
      setContents(filtered.map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content
      })));
    }

    // Sınıf ve ders isimlerini çek
    async function loadNames() {
      const [{ data: g }, { data: l }] = await Promise.all([
        supabase.from('grades').select('name').eq('id', parseInt(gradeId)).single(),
        supabase.from('lessons').select('name').eq('id', parseInt(lessonId)).single()
      ]);
      setGradeName(g?.name || '');
      setLessonName(l?.name || '');
    }

    Promise.all([loadOutcomes(), loadContents(), loadNames()]).finally(() => setLoading(false));
  }, [gradeId, lessonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
            <Link href="/" className="text-zinc-400 hover:text-white">← Geri</Link>
          </div>
          <div className="bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-zinc-700">
            {WEEK}. Hafta
          </div>
        </div>
      </nav>

      <main className="pt-[100px] pb-20 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-white/10 p-6 sm:p-8 mb-8">
            <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
              <span>🎓 {gradeName}</span>
              <span>→</span>
              <span>📚 {lessonName}</span>
              <span>→</span>
              <span>{WEEK}. Hafta</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              {WEEK}. Hafta Konuları
            </h1>
            <p className="text-zinc-400">{outcomes.length} kazanım</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setActiveTab('kazanimlar')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'kazanimlar'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-zinc-900/50 text-zinc-400 hover:text-white'
              }`}
            >
              🎯 Kazanımlar
            </button>
            <button
              onClick={() => setActiveTab('icerik')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === 'icerik'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-zinc-900/50 text-zinc-400 hover:text-white'
              }`}
            >
              📚 Konu Anlatımı
            </button>
          </div>

          {/* Content */}
          {activeTab === 'kazanimlar' && (
            <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-white mb-6">Bu Haftanın Kazanımları</h2>
              {outcomes.length === 0 ? (
                <p className="text-zinc-400">Bu hafta için kazanım bulunmuyor.</p>
              ) : (
                <div className="space-y-4">
                  {outcomes.map((outcome, index) => (
                    <div key={outcome.id} className="flex items-start gap-4 p-4 rounded-xl bg-zinc-800/30">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-zinc-300">{outcome.description}</p>
                        <p className="text-zinc-500 text-sm mt-1">{outcome.topic_title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'icerik' && (
            <div className="space-y-6">
              {contents.length === 0 ? (
                <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8 text-center">
                  <p className="text-zinc-400">Bu hafta için konu içeriği bulunmuyor.</p>
                </div>
              ) : (
                contents.map((content) => (
                  <div key={content.id} className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6 sm:p-8">
                    <h2 className="text-xl font-semibold text-white mb-4">{content.title}</h2>
                    <div 
                      className="prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: content.content }}
                    />
                  </div>
                ))
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
