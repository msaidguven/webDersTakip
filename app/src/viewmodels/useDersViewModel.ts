'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LessonData, DersState, Outcome, TopicContent } from '../models/dersTypes';

const SUPABASE_URL = 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';
const CURRENT_WEEK = 19;

interface UseDersViewModelReturn {
  state: DersState;
  setActiveTab: (tab: 'outcomes' | 'content') => void;
  refreshData: () => Promise<void>;
}

export function useDersViewModel(
  gradeId: string | null,
  lessonId: string | null
): UseDersViewModelReturn {
  const [state, setState] = useState<DersState>({
    data: null,
    isLoading: true,
    error: null,
    activeTab: 'outcomes',
  });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const fetchNames = useCallback(async (
    gId: number,
    lId: number
  ): Promise<{ gradeName: string; lessonName: string }> => {
    const [{ data: grade }, { data: lesson }] = await Promise.all([
      supabase.from('grades').select('name').eq('id', gId).single(),
      supabase.from('lessons').select('name').eq('id', lId).single(),
    ]);

    return {
      gradeName: grade?.name || '',
      lessonName: lesson?.name || '',
    };
  }, [supabase]);

  const fetchOutcomes = useCallback(async (lId: number): Promise<Outcome[]> => {
    const { data: weekOutcomes } = await supabase
      .from('outcome_weeks')
      .select('outcome_id')
      .lte('start_week', CURRENT_WEEK)
      .gte('end_week', CURRENT_WEEK);

    if (!weekOutcomes?.length) return [];

    const { data } = await supabase
      .from('outcomes')
      .select('id, description, topics!inner(title, units!inner(lesson_id))')
      .in('id', weekOutcomes.map((w: any) => w.outcome_id));

    return (data || [])
      .filter((o: any) => o.topics?.units?.lesson_id === lId)
      .map((o: any) => ({
        id: o.id,
        description: o.description,
        topicTitle: o.topics?.title || '',
      }));
  }, [supabase]);

  const fetchContents = useCallback(async (lId: number): Promise<TopicContent[]> => {
    const { data: weekContents } = await supabase
      .from('topic_content_weeks')
      .select('topic_content_id')
      .eq('curriculum_week', CURRENT_WEEK);

    if (!weekContents?.length) return [];

    const { data } = await supabase
      .from('topic_contents')
      .select('id, title, content, order_no, topics!inner(units!inner(lesson_id))')
      .in('id', weekContents.map((w: any) => w.topic_content_id))
      .order('order_no');

    return (data || [])
      .filter((c: any) => c.topics?.units?.lesson_id === lId)
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        orderNo: c.order_no,
      }));
  }, [supabase]);

  const loadData = useCallback(async () => {
    if (!gradeId || !lessonId) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Sinif veya ders bilgisi eksik',
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [names, outcomes, contents] = await Promise.all([
        fetchNames(parseInt(gradeId), parseInt(lessonId)),
        fetchOutcomes(parseInt(lessonId)),
        fetchContents(parseInt(lessonId)),
      ]);

      setState(prev => ({
        ...prev,
        data: { ...names, outcomes, contents },
        isLoading: false,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Veriler yuklenirken bir hata olustu',
      }));
    }
  }, [gradeId, lessonId, fetchNames, fetchOutcomes, fetchContents]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setActiveTab = useCallback((tab: 'outcomes' | 'content') => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  return {
    state,
    setActiveTab,
    refreshData,
  };
}
