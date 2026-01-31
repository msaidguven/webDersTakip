'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Grade, Lesson, Unit, Topic, SelectionStep, HomeSelectionState } from '../models/homeTypes';
import { getLessonsByGrade, getUnitsByLesson } from '../data/homeMockData';

// Fallback mock grades when Supabase is not configured
const mockGrades: Grade[] = [
  { id: '6', level: 6, name: '6. Sınıf', description: 'Ortaokul 1. seviye', icon: '📚', color: 'from-emerald-500 to-teal-500' },
  { id: '7', level: 7, name: '7. Sınıf', description: 'Ortaokul 2. seviye', icon: '📖', color: 'from-cyan-500 to-blue-500' },
  { id: '8', level: 8, name: '8. Sınıf', description: 'Ortaokul 3. seviye - LGS', icon: '🎯', color: 'from-blue-500 to-indigo-500' },
  { id: '9', level: 9, name: '9. Sınıf', description: 'Lise 1. sınıf', icon: '🎓', color: 'from-indigo-500 to-purple-500' },
  { id: '10', level: 10, name: '10. Sınıf', description: 'Lise 2. sınıf', icon: '🔬', color: 'from-purple-500 to-pink-500' },
  { id: '11', level: 11, name: '11. Sınıf', description: 'Lise 3. sınıf - YKS hazırlık', icon: '⚡', color: 'from-pink-500 to-rose-500' },
  { id: '12', level: 12, name: '12. Sınıf', description: 'Lise 4. sınıf - YKS', icon: '🚀', color: 'from-orange-500 to-amber-500' },
];

// URL'i temizle (tırnaklar ve noktalı virgül kaldır)
function cleanEnvValue(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/^['"]+/, '') // Baştaki tırnakları kaldır
    .replace(/['";]+$/, '') // Sondaki tırnak ve noktalı virgülü kaldır
    .trim();
}

interface UseHomeViewModelReturn {
  grades: Grade[];
  availableLessons: Lesson[];
  availableUnits: Unit[];
  selection: HomeSelectionState;
  isLoadingGrades: boolean;
  gradesError: string | null;
  totalQuestions: number;
  totalTime: number;
  canStartTest: boolean;
  selectGrade: (grade: Grade) => void;
  selectLesson: (lesson: Lesson) => void;
  selectUnit: (unit: Unit) => void;
  toggleTopic: (topic: Topic) => void;
  selectAllTopics: (topics: Topic[]) => void;
  clearTopics: () => void;
  goBack: () => void;
  goToConfirm: () => void;
  reset: () => void;
}

export function useHomeViewModel(): UseHomeViewModelReturn {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [gradesError, setGradesError] = useState<string | null>(null);
  
  const [selection, setSelection] = useState<HomeSelectionState>({
    step: 'grade',
    selectedGrade: null,
    selectedLesson: null,
    selectedUnit: null,
    selectedTopics: [],
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      console.log('[fetchGrades] Server-side, skipping...');
      return;
    }

    async function fetchGrades() {
      console.log('[fetchGrades] Starting client-side fetch...');
      
      try {
        setIsLoadingGrades(true);
        setGradesError(null);
        
        // Environment variables'ı temizle
        const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        const supabaseUrl = cleanEnvValue(rawUrl);
        const supabaseKey = cleanEnvValue(rawKey);
        
        console.log('[fetchGrades] Cleaned URL:', supabaseUrl);
        console.log('[fetchGrades] Cleaned Key exists:', !!supabaseKey);
        
        if (!supabaseUrl || !supabaseKey) {
          console.log('[fetchGrades] Using mock data (Supabase not configured)');
          setTimeout(() => {
            setGrades(mockGrades);
            setIsLoadingGrades(false);
          }, 500);
          return;
        }
        
        // URL validasyonu
        try {
          new URL(supabaseUrl);
          console.log('[fetchGrades] URL is valid');
        } catch (e) {
          console.error('[fetchGrades] Invalid URL:', supabaseUrl);
          throw new Error(`Invalid URL: ${supabaseUrl}`);
        }
        
        console.log('[fetchGrades] Creating Supabase client...');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        console.log('[fetchGrades] Calling RPC get_active_grades...');
        const { data, error } = await supabase.rpc('get_active_grades');
        
        console.log('[fetchGrades] RPC response:', { data, error });
        
        if (error) {
          console.error('[fetchGrades] RPC Error:', error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          console.log('[fetchGrades] No data from DB, using mock data');
          setGrades(mockGrades);
          setIsLoadingGrades(false);
          return;
        }
        
        const transformedGrades: Grade[] = data.map((item: any) => ({
          id: item.id.toString(),
          level: item.order_no,
          name: item.name,
          description: getGradeDescription(item.order_no),
          icon: getGradeIcon(item.order_no),
          color: getGradeColor(item.order_no),
        }));
        
        console.log('[fetchGrades] Transformed grades:', transformedGrades);
        setGrades(transformedGrades);
      } catch (err: any) {
        console.error('[fetchGrades] Error:', err);
        setGradesError(err.message);
        setGrades(mockGrades);
      } finally {
        setIsLoadingGrades(false);
      }
    }
    
    fetchGrades();
  }, []);

  function getGradeDescription(level: number): string {
    const descriptions: Record<number, string> = {
      6: 'Ortaokul 1. seviye',
      7: 'Ortaokul 2. seviye',
      8: 'Ortaokul 3. seviye - LGS',
      9: 'Lise 1. sınıf',
      10: 'Lise 2. sınıf',
      11: 'Lise 3. sınıf - YKS hazırlık',
      12: 'Lise 4. sınıf - YKS',
    };
    return descriptions[level] || `${level}. Sınıf`;
  }

  function getGradeIcon(level: number): string {
    const icons: Record<number, string> = {
      6: '📚', 7: '📖', 8: '🎯', 9: '🎓', 10: '🔬', 11: '⚡', 12: '🚀',
    };
    return icons[level] || '📖';
  }

  function getGradeColor(level: number): string {
    const colors: Record<number, string> = {
      6: 'from-emerald-500 to-teal-500',
      7: 'from-cyan-500 to-blue-500',
      8: 'from-blue-500 to-indigo-500',
      9: 'from-indigo-500 to-purple-500',
      10: 'from-purple-500 to-pink-500',
      11: 'from-pink-500 to-rose-500',
      12: 'from-orange-500 to-amber-500',
    };
    return colors[level] || 'from-indigo-500 to-purple-500';
  }

  const selectGrade = useCallback((grade: Grade) => {
    const lessons = getLessonsByGrade(grade.id);
    setAvailableLessons(lessons);
    setSelection(prev => ({
      ...prev,
      step: 'lesson',
      selectedGrade: grade,
      selectedLesson: null,
      selectedUnit: null,
      selectedTopics: [],
    }));
  }, []);

  const selectLesson = useCallback((lesson: Lesson) => {
    const units = getUnitsByLesson(lesson.id);
    setAvailableUnits(units);
    setSelection(prev => ({
      ...prev,
      step: 'unit',
      selectedLesson: lesson,
      selectedUnit: null,
      selectedTopics: [],
    }));
  }, []);

  const selectUnit = useCallback((unit: Unit) => {
    setSelection(prev => ({
      ...prev,
      step: 'topic',
      selectedUnit: unit,
      selectedTopics: [],
    }));
  }, []);

  const toggleTopic = useCallback((topic: Topic) => {
    setSelection(prev => {
      const isSelected = prev.selectedTopics.some(t => t.id === topic.id);
      if (isSelected) {
        return {
          ...prev,
          selectedTopics: prev.selectedTopics.filter(t => t.id !== topic.id),
        };
      } else {
        return {
          ...prev,
          selectedTopics: [...prev.selectedTopics, topic],
        };
      }
    });
  }, []);

  const selectAllTopics = useCallback((topics: Topic[]) => {
    setSelection(prev => ({
      ...prev,
      selectedTopics: topics,
    }));
  }, []);

  const clearTopics = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      selectedTopics: [],
    }));
  }, []);

  const goBack = useCallback(() => {
    setSelection(prev => {
      switch (prev.step) {
        case 'lesson':
          return { ...prev, step: 'grade', selectedGrade: null };
        case 'unit':
          return { ...prev, step: 'lesson', selectedLesson: null };
        case 'topic':
          return { ...prev, step: 'unit', selectedUnit: null, selectedTopics: [] };
        case 'confirm':
          return { ...prev, step: 'topic' };
        default:
          return prev;
      }
    });
  }, []);

  const goToConfirm = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      step: 'confirm',
    }));
  }, []);

  const getTotalQuestions = useCallback(() => {
    return selection.selectedTopics.reduce((sum, topic) => sum + topic.questionCount, 0);
  }, [selection.selectedTopics]);

  const getTotalTime = useCallback(() => {
    return selection.selectedTopics.reduce((sum, topic) => sum + topic.estimatedTime, 0);
  }, [selection.selectedTopics]);

  const reset = useCallback(() => {
    setSelection({
      step: 'grade',
      selectedGrade: null,
      selectedLesson: null,
      selectedUnit: null,
      selectedTopics: [],
    });
    setAvailableLessons([]);
    setAvailableUnits([]);
  }, []);

  return {
    grades,
    availableLessons,
    availableUnits,
    selection,
    isLoadingGrades,
    gradesError,
    totalQuestions: getTotalQuestions(),
    totalTime: getTotalTime(),
    canStartTest: selection.selectedTopics.length > 0,
    selectGrade,
    selectLesson,
    selectUnit,
    toggleTopic,
    selectAllTopics,
    clearTopics,
    goBack,
    goToConfirm,
    reset,
  };
}
