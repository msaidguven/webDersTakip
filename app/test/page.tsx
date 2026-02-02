'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface QuestionTypeInfo {
  type: string;
  count: number;
  page: string;
}

function TestRouterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const lessonId = searchParams.get('lesson_id');
  const week = searchParams.get('week');

  const [loading, setLoading] = useState(true);
  const [availableTypes, setAvailableTypes] = useState<QuestionTypeInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkAvailableQuestions() {
      if (!lessonId || !week) {
        setError('Ders veya hafta bilgisi eksik');
        setLoading(false);
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

      if (!supabaseUrl || !supabaseKey) {
        setError('Veritabanı yapılandırması eksik.');
        setLoading(false);
        return;
      }
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 1. Bu dersin unit'lerini bul
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('lesson_id', parseInt(lessonId));

      if (!units?.length) {
        setError('Bu ders için içerik bulunamadı');
        setLoading(false);
        return;
      }

      const unitIds = units.map(u => u.id);

      // 2. Topic'leri bul
      const { data: topics } = await supabase
        .from('topics')
        .select('id')
        .in('unit_id', unitIds);

      if (!topics?.length) {
        setError('Konu bulunamadı');
        setLoading(false);
        return;
      }

      const topicIds = topics.map(t => t.id);

      // 3. Her soru tipinden kaç tane var kontrol et
      const types: QuestionTypeInfo[] = [];

      // Çoktan seçmeli (type_id: 1)
      const { count: mcCount } = await supabase
        .from('question_usages')
        .select('*', { count: 'exact' })
        .in('topic_id', topicIds)
        .eq('curriculum_week', parseInt(week))
        .eq('usage_type', 'weekly');

      if (mcCount && mcCount > 0) {
        types.push({ type: 'Coktan Secmeli', count: mcCount, page: 'haftalik-test' });
      }

      // Eşleştirme (type_id: 4)
      const { data: matchingQuestions } = await supabase
        .from('questions')
        .select('id')
        .eq('question_type_id', 4);

      if (matchingQuestions?.length) {
        const { count: matchCount } = await supabase
          .from('question_usages')
          .select('*', { count: 'exact' })
          .in('topic_id', topicIds)
          .in('question_id', matchingQuestions.map(q => q.id))
          .eq('curriculum_week', parseInt(week));
        
        if (matchCount && matchCount > 0) {
          types.push({ type: 'Eslestirme', count: matchCount, page: 'eslestirme' });
        }
      }

      // Klasik (type_id: 2)
      const { data: classicalQuestions } = await supabase
        .from('questions')
        .select('id')
        .eq('question_type_id', 2);

      if (classicalQuestions?.length) {
        const { count: classCount } = await supabase
          .from('question_usages')
          .select('*', { count: 'exact' })
          .in('topic_id', topicIds)
          .in('question_id', classicalQuestions.map(q => q.id))
          .eq('curriculum_week', parseInt(week));
        
        if (classCount && classCount > 0) {
          types.push({ type: 'Klasik', count: classCount, page: 'klasik-test' });
        }
      }

      // Boşluk (type_id: 3)
      const { data: blankQuestions } = await supabase
        .from('questions')
        .select('id')
        .eq('question_type_id', 3);

      if (blankQuestions?.length) {
        const { count: blankCount } = await supabase
          .from('question_usages')
          .select('*', { count: 'exact' })
          .in('topic_id', topicIds)
          .in('question_id', blankQuestions.map(q => q.id))
          .eq('curriculum_week', parseInt(week));
        
        if (blankCount && blankCount > 0) {
          types.push({ type: 'Bosluk Doldurma', count: blankCount, page: 'bosluk-test' });
        }
      }

      setAvailableTypes(types);
      setLoading(false);

      // Eğer sadece 1 tip varsa otomatik yönlendir
      if (types.length === 1) {
        router.push(`/${types[0].page}?lesson_id=${lessonId}&week=${week}`);
      }
    }

    checkAvailableQuestions();
  }, [lessonId, week, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted">Test turleri kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-4xl mx-auto mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-default mb-4">Hata</h1>
          <p className="text-muted mb-6">{error}</p>
          <button onClick={() => window.history.back()} className="px-6 py-3 rounded-xl bg-indigo-500 text-default">
            Geri Don
          </button>
        </div>
      </div>
    );
  }

  if (availableTypes.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-4xl mx-auto mb-6">📝</div>
          <h1 className="text-2xl font-bold text-default mb-4">Test Bulunamadi</h1>
          <p className="text-muted mb-6">Bu ders ve hafta icin hicbir soru tipi bulunmuyor.</p>
          <button onClick={() => window.history.back()} className="px-6 py-3 rounded-xl bg-indigo-500 text-default">
            Derse Don
          </button>
        </div>
      </div>
    );
  }

  // Birden fazla tip varsa seçim ekrani göster
  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-4xl mx-auto mb-6">
            🎯
          </div>
          <h1 className="text-3xl font-bold text-default mb-2">Test Secimi</h1>
          <p className="text-muted">Bu hafta icin {availableTypes.length} farkli test turu mevcut</p>
        </div>

        <div className="grid gap-4">
          {availableTypes.map((type) => (
            <a
              key={type.page}
              href={`/${type.page}?lesson_id=${lessonId}&week=${week}`}
              className="block rounded-2xl bg-surface-elevated border border-default p-6 hover:bg-zinc-800/50 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-2xl">
                    {type.page === 'haftalik-test' && '📝'}
                    {type.page === 'eslestirme' && '🔗'}
                    {type.page === 'klasik-test' && '✏️'}
                    {type.page === 'bosluk-test' && '📝'}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-default group-hover:text-indigo-400 transition-colors">
                      {type.type}
                    </h3>
                    <p className="text-muted">{type.count} soru</p>
                  </div>
                </div>
                <div className="text-muted group-hover:text-default transition-colors">
                  →
                </div>
              </div>
            </a>
          ))}
        </div>

        <button 
          onClick={() => window.history.back()}
          className="w-full mt-6 py-3 rounded-xl bg-zinc-800 text-muted hover:text-default transition-colors"
        >
          ← Vazgec
        </button>
      </div>
    </div>
  );
}

export default function TestRouterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0f0f11]" />}>
      <TestRouterContent />
    </Suspense>
  );
}
