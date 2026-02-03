'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '../lib/supabaseClient';
import { Grade, Lesson, Unit, Topic, SelectionStep, HomeSelectionState } from '../models/homeTypes';

interface UseHomeViewModelReturn {
  grades: Grade[];
  availableLessons: Lesson[];
  availableUnits: Unit[];
  selection: HomeSelectionState;
  isLoadingGrades: boolean;
  isLoadingLessons: boolean;
  gradesError: string | null;
  lessonsError: string | null;
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
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);
  const [lessonsError, setLessonsError] = useState<string | null>(null);
  
  const [selection, setSelection] = useState<HomeSelectionState>({
    step: 'grade',
    selectedGrade: null,
    selectedLesson: null,
    selectedUnit: null,
    selectedTopics: [],
  });

  // Sınıfları çek - SADECE DB'den
  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function fetchGrades() {
      try {
        setIsLoadingGrades(true);
        setGradesError(null);
        
        const supabase = createSupabaseBrowserClient();
        
        if (!supabase) {
          setGradesError('Bağlantı hatası. Lütfen daha sonra tekrar deneyin.');
          return;
        }
        
        const { data, error } = await supabase.rpc('web_get_active_grades');
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
          setGradesError('Aktif sınıf bulunamadı.');
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
        
        setGrades(transformedGrades);
      } catch (err: any) {
        console.error('Sınıflar yüklenirken hata:', err);
        setGradesError('Sınıflar yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
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

  // Sınıfa tıklayınca dersleri çek - SADECE DB'den
  const selectGrade = useCallback(async (grade: Grade) => {
    try {
      setIsLoadingLessons(true);
      setLessonsError(null);
      
      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setLessonsError('Bağlantı hatası. Lütfen daha sonra tekrar deneyin.');
        return;
      }
      
      const { data, error } = await supabase.rpc('web_get_lessons_for_grade', {
        p_grade_id: parseInt(grade.id)
      });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const transformedLessons: Lesson[] = data.map((item: any) => ({
          id: item.id.toString(),
          gradeId: grade.id,
          name: item.name,
          description: item.description || '',
          icon: item.icon || '📚',
          color: getLessonColor(item.order_no || 0),
          unitCount: 0,
          questionCount: item.question_count || 0,
        }));
        setAvailableLessons(transformedLessons);
      } else {
        setAvailableLessons([]);
      }
      
      setSelection(prev => ({
        ...prev,
        step: 'lesson',
        selectedGrade: grade,
        selectedLesson: null,
        selectedUnit: null,
        selectedTopics: [],
      }));
    } catch (err: any) {
      console.error('Dersler yüklenirken hata:', err);
      setLessonsError('Dersler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoadingLessons(false);
    }
  }, []);

  function getLessonColor(orderNo: number): string {
    const colors = [
      'from-indigo-500 to-purple-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-amber-500',
      'from-blue-500 to-cyan-500',
      'from-pink-500 to-rose-500',
    ];
    return colors[orderNo % colors.length];
  }

  // Ders seçildiğinde /ders sayfasına git
  const selectLesson = useCallback((lesson: Lesson) => {
    setSelection(prev => ({
      ...prev,
      step: 'unit',
      selectedLesson: lesson,
      selectedUnit: null,
      selectedTopics: [],
    }));
    
    const gradeId = lesson.gradeId;
    if (gradeId) {
      const url = `/ders?grade_id=${gradeId}&lesson_id=${lesson.id}`;
      router.push(url);
    }
  }, [router]);

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
    isLoadingLessons,
    gradesError,
    lessonsError,
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
