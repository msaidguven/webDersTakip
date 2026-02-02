'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; 
import { DersState, Outcome, TopicContent } from '../models/dersTypes';
const CURRENT_WEEK = 19;

export function useDersViewModel(gradeId: string | null, lessonId: string | null) {
  const [state, setState] = useState<DersState>({
    data: null,
    isLoading: true,
    error: null,
    activeTab: 'outcomes',
  });

  // İçerik ayrı yüklenecek
  const [contents, setContents] = useState<TopicContent[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsLoaded, setContentsLoaded] = useState(false);

  // Supabase client'ı sadece bir kez oluştur
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwzbjhgrhkcdyowknmhe.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_cXSIkRvdM3hsu2ZIFjSYVQ_XRhlmng8';

    if (supabaseUrl && supabaseKey) {
      return createClient(supabaseUrl, supabaseKey);
    }
    console.error('Supabase URL or Key is missing in environment variables.');
    return null;
  }, []);

  // Kazanımlar ve temel bilgiler - sayfa açılırken yüklensin
  useEffect(() => {
    let isCancelled = false;

    async function loadOutcomes() {
      if (!supabase) {
        if (!isCancelled) {
          setState(prev => ({ ...prev, isLoading: false, error: 'Veritabanı yapılandırması eksik.' }));
        }
        return;
      }

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

        // Temel bilgiler
        const [{ data: grade }, { data: lesson }] = await Promise.all([
          supabase.from('grades').select('name').eq('id', gId).single(),
          supabase.from('lessons').select('name').eq('id', lId).single(),
        ]);

        const names = {
          gradeName: grade?.name || '',
          lessonName: lesson?.name || '',
        };

        // Kazanımları çek (hızlı)
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

        if (!isCancelled) {
          setState({
            data: { ...names, outcomes, contents: [] },
            isLoading: false,
            error: null,
            activeTab: 'outcomes',
          });
        }

        // Kazanımlar yüklendikten sonra içerikleri arka planda yükle
        loadContentsInBackground(lId);
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

    async function loadContentsInBackground(lId: number) {
      if (!supabase) return;

      try {
        const { data: weekContents } = await supabase
          .from('topic_content_weeks')
          .select('topic_content_id')
          .eq('curriculum_week', CURRENT_WEEK);

        let loadedContents: TopicContent[] = [];
        if (weekContents?.length) {
          const contentIds = weekContents.map((w: any) => w.topic_content_id);
          const { data: contentsData } = await supabase
            .from('topic_contents')
            .select('id, title, content, order_no, topics!inner(units!inner(lesson_id))')
            .in('id', contentIds)
            .order('order_no');

          loadedContents = (contentsData || [])
            .filter((c: any) => c.topics?.units?.lesson_id === lId)
            .map((c: any) => ({
              id: c.id,
              title: c.title,
              content: c.content,
              orderNo: c.order_no,
            }));
        }

        setContents(loadedContents);
        setContentsLoaded(true);
        
        // State'i güncelle (arka planda)
        setState(prev => ({
          ...prev,
          data: prev.data ? { ...prev.data, contents: loadedContents } : null,
        }));
      } catch (err) {
        console.error('Arka plan içerik yükleme hatası:', err);
      }
    }

    loadOutcomes();

    return () => { isCancelled = true; };
  }, [gradeId, lessonId, supabase]);

  // İçerikleri ayrı yükle (lazy loading)
  const loadContents = useCallback(async () => {
    if (!lessonId || contentsLoaded || contentsLoading || !supabase) return;

    setContentsLoading(true);

    try {
      const lId = parseInt(lessonId);

      const { data: weekContents } = await supabase
        .from('topic_content_weeks')
        .select('topic_content_id')
        .eq('curriculum_week', CURRENT_WEEK);

      let loadedContents: TopicContent[] = [];
      if (weekContents?.length) {
        const contentIds = weekContents.map((w: any) => w.topic_content_id);
        const { data: contentsData } = await supabase
          .from('topic_contents')
          .select('id, title, content, order_no, topics!inner(units!inner(lesson_id))')
          .in('id', contentIds)
          .order('order_no');

        loadedContents = (contentsData || [])
          .filter((c: any) => c.topics?.units?.lesson_id === lId)
          .map((c: any) => ({
            id: c.id,
            title: c.title,
            content: c.content,
            orderNo: c.order_no,
          }));
      }

      setContents(loadedContents);
      setContentsLoaded(true);
      
      // State'i güncelle
      setState(prev => ({
        ...prev,
        data: prev.data ? { ...prev.data, contents: loadedContents } : null,
      }));
    } catch (err) {
      console.error('İçerikler yüklenirken hata:', err);
    } finally {
      setContentsLoading(false);
    }
  }, [lessonId, supabase, contentsLoaded, contentsLoading]);

  const setActiveTab = useCallback((tab: 'outcomes' | 'content') => {
    setState(prev => ({ ...prev, activeTab: tab }));
    
    // Konu anlatımı tab'ına geçince içerikleri yükle
    if (tab === 'content') {
      loadContents();
    }
  }, [loadContents]);

  const refreshData = useCallback(async () => {
    setContentsLoaded(false);
    setContents([]);
    setState(prev => ({ 
      ...prev, 
      isLoading: true,
      data: prev.data ? { ...prev.data, contents: [] } : null 
    }));
    
    // useEffect'i tetiklemek için state değiştir
    await new Promise(resolve => setTimeout(resolve, 10));
    setState(prev => ({ ...prev, isLoading: false }));
  }, []);

  return {
    state,
    contentsLoading,
    setActiveTab,
    refreshData,
  };
}
