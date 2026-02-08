'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DersState, Outcome, TopicContent } from '../models/dersTypes';
import { createClient } from '@/utils/supabase/client';
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
  const supabase = useMemo(() => createClient(), []);

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

        // Kazanımları ve ünite adını çek (RPC fonksiyonu kullan)
        const { data: weekOutcomes, error: outcomesError } = await supabase.rpc(
          'get_week_view_web',
          {
            p_lesson_id: lId,
            p_grade_id: gId,
            p_week_number: CURRENT_WEEK,
          }
        );

        if (outcomesError) throw outcomesError;

        // Ünite adını ilk kayıttan al (tüm kayıtlar aynı üniteye ait)
        const unitName = weekOutcomes?.[0]?.unit_title || '';

        // Kazanımları map'le
        const outcomes: Outcome[] = (weekOutcomes || []).map((o: any) => ({
          id: o.id,
          description: o.description,
          topicTitle: o.topic_title || '',
        }));

        if (!isCancelled) {
          setState({
            data: { 
              gradeName: grade?.name || '', 
              lessonName: lesson?.name || '',
              unitName: unitName,
              outcomes, 
              contents: [] 
            },
            isLoading: false,
            error: null,
            activeTab: 'outcomes',
          });
        }

        // Kazanımlar yüklendikten sonra içerikleri arka planda yükle
        loadContentsInBackground(lId, gId);
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

    async function loadContentsInBackground(lId: number, gId: number) {
      if (!supabase) return;

      try {
        // Konu içeriklerini RPC fonksiyonu ile çek
        const { data: weekContents, error: contentsError } = await supabase.rpc(
          'web_get_topic_contents_for_week',
          {
            p_lesson_id: lId,
            p_grade_id: gId,
            p_week_number: CURRENT_WEEK,
          }
        );

        if (contentsError) throw contentsError;

        const loadedContents: TopicContent[] = (weekContents || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          content: c.content,
          orderNo: c.order_no,
        }));

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
    if (!lessonId || !gradeId || contentsLoaded || contentsLoading || !supabase) return;

    setContentsLoading(true);

    try {
      const lId = parseInt(lessonId);
      const gId = parseInt(gradeId);

      // Konu içeriklerini RPC fonksiyonu ile çek
      const { data: weekContents, error: contentsError } = await supabase.rpc(
        'web_get_topic_contents_for_week',
        {
          p_lesson_id: lId,
          p_grade_id: gId,
          p_week_number: CURRENT_WEEK,
        }
      );

      if (contentsError) throw contentsError;

      const loadedContents: TopicContent[] = (weekContents || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        orderNo: c.order_no,
      }));

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
  }, [lessonId, gradeId, supabase, contentsLoaded, contentsLoading]);

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
