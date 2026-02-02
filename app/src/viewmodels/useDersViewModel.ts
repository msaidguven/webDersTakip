'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DersState, Outcome, TopicContent } from '../models/dersTypes';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';
const CURRENT_WEEK = 19;

export function useDersViewModel(gradeId: string | null, lessonId: string | null) {
  const [state, setState] = useState<DersState>({
    data: null,
    isLoading: true,
    error: null,
    activeTab: 'outcomes',
  });

  // Supabase client'ı sadece bir kez oluştur
  const supabase = useMemo(() => createClient(SUPABASE_URL, SUPABASE_KEY), []);

  // Veri yükleme - sadece gradeId/lessonId değişince çalışır
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      if (!gradeId || !lessonId) {
        if (!isCancelled) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Sinif veya ders bilgisi eksik',
          }));
        }
        return;
      }

      if (!isCancelled) {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const gId = parseInt(gradeId);
        const lId = parseInt(lessonId);

        // Doğrudan veri çek, fonksiyon referanslarına bağımlı olma
        const [{ data: grade }, { data: lesson }] = await Promise.all([
          supabase.from('grades').select('name').eq('id', gId).single(),
          supabase.from('lessons').select('name').eq('id', lId).single(),
        ]);

        const names = {
          gradeName: grade?.name || '',
          lessonName: lesson?.name || '',
        };

        // Kazanımları çek
        const { data: weekOutcomes } = await supabase
          .from('outcome_weeks')
          .select('outcome_id')
          .lte('start_week', CURRENT_WEEK)
          .gte('end_week', CURRENT_WEEK);

        let outcomes: Outcome[] = [];
        if (weekOutcomes?.length) {
          const { data: outcomesData } = await supabase
            .from('outcomes')
            .select('id, description, topics!inner(title, units!inner(lesson_id))')
            .in('id', weekOutcomes.map((w: any) => w.outcome_id));

          outcomes = (outcomesData || [])
            .filter((o: any) => o.topics?.units?.lesson_id === lId)
            .map((o: any) => ({
              id: o.id,
              description: o.description,
              topicTitle: o.topics?.title || '',
            }));
        }

        // İçerikleri çek
        const { data: weekContents } = await supabase
          .from('topic_content_weeks')
          .select('topic_content_id')
          .eq('curriculum_week', CURRENT_WEEK);

        let contents: TopicContent[] = [];
        if (weekContents?.length) {
          const contentIds = weekContents.map((w: any) => w.topic_content_id);
          const { data: contentsData } = await supabase
            .from('topic_contents')
            .select('id, title, content, order_no, topics!inner(units!inner(lesson_id))')
            .in('id', contentIds)
            .order('order_no');

          contents = (contentsData || [])
            .filter((c: any) => c.topics?.units?.lesson_id === lId)
            .map((c: any) => ({
              id: c.id,
              title: c.title,
              content: c.content,
              orderNo: c.order_no,
            }));
        }

        if (!isCancelled) {
          setState({
            data: { ...names, outcomes, contents },
            isLoading: false,
            error: null,
            activeTab: 'outcomes',
          });
        }
      } catch (err: any) {
        if (!isCancelled) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: err.message || 'Veriler yuklenirken bir hata olustu',
          }));
        }
      }
    }

    loadData();

    return () => { isCancelled = true; };
  }, [gradeId, lessonId, supabase]);

  const setActiveTab = useCallback((tab: 'outcomes' | 'content') => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const refreshData = useCallback(async () => {
    // Force re-trigger useEffect by setting loading state
    setState(prev => ({ ...prev, isLoading: true }));
    // Small delay to ensure state update propagates
    await new Promise(resolve => setTimeout(resolve, 10));
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  return {
    state,
    setActiveTab,
    refreshData,
  };
}
