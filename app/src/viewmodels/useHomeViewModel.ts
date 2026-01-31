'use client';

import { useState, useCallback, useEffect } from 'react';
import { Grade, Lesson, Unit, Topic, SelectionStep, HomeSelectionState } from '../models/homeTypes';
import { getLessonsByGrade, getUnitsByLesson } from '../data/homeMockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

interface UseHomeViewModelReturn {
  // Data
  grades: Grade[];
  availableLessons: Lesson[];
  availableUnits: Unit[];
  selection: HomeSelectionState;
  
  // Loading states
  isLoadingGrades: boolean;
  gradesError: string | null;
  
  // Computed
  totalQuestions: number;
  totalTime: number;
  canStartTest: boolean;
  
  // Actions
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
  // Data states
  const [grades, setGrades] = useState<Grade[]>([]);
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  
  // Loading states
  const [isLoadingGrades, setIsLoadingGrades] = useState(true);
  const [gradesError, setGradesError] = useState<string | null>(null);
  
  // Selection state
  const [selection, setSelection] = useState<HomeSelectionState>({
    step: 'grade',
    selectedGrade: null,
    selectedLesson: null,
    selectedUnit: null,
    selectedTopics: [],
  });

  // Fetch grades from Supabase on mount
  useEffect(() => {
    async function fetchGrades() {
      try {
        setIsLoadingGrades(true);
        setGradesError(null);
        
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          console.log('Supabase not configured, using mock data');
          setGrades(mockGrades);
          setIsLoadingGrades(false);
          return;
        }
        
        const { data, error } = await supabase!.rpc('get_active_grades');
        
        if (error) {
          throw error;
        }
        
        // Transform database data to Grade type
        const transformedGrades: Grade[] = (data || []).map((item: any) => ({
          id: item.id.toString(),
          level: item.order_no,
          name: item.name,
          description: getGradeDescription(item.order_no),
          icon: getGradeIcon(item.order_no),
          color: getGradeColor(item.order_no),
        }));
        
        setGrades(transformedGrades);
      } catch (err: any) {
        console.error('Error fetching grades:', err);
        setGradesError(err.message);
        // Fallback to mock data on error
        setGrades(mockGrades);
      } finally {
        setIsLoadingGrades(false);
      }
    }
    
    fetchGrades();
  }, []);

  // Helper functions for grade transformation
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
      6: '📚',
      7: '📖',
      8: '🎯',
      9: '🎓',
      10: '🔬',
      11: '⚡',
      12: '🚀',
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

  // Select Grade
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

  // Select Lesson
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

  // Select Unit
  const selectUnit = useCallback((unit: Unit) => {
    setSelection(prev => ({
      ...prev,
      step: 'topic',
      selectedUnit: unit,
      selectedTopics: [],
    }));
  }, []);

  // Toggle Topic Selection
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

  // Select All Topics in Unit
  const selectAllTopics = useCallback((topics: Topic[]) => {
    setSelection(prev => ({
      ...prev,
      selectedTopics: topics,
    }));
  }, []);

  // Clear All Topics
  const clearTopics = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      selectedTopics: [],
    }));
  }, []);

  // Go Back
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

  // Go to Confirmation
  const goToConfirm = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      step: 'confirm',
    }));
  }, []);

  // Get Total Question Count
  const getTotalQuestions = useCallback(() => {
    return selection.selectedTopics.reduce((sum, topic) => sum + topic.questionCount, 0);
  }, [selection.selectedTopics]);

  // Get Total Estimated Time
  const getTotalTime = useCallback(() => {
    return selection.selectedTopics.reduce((sum, topic) => sum + topic.estimatedTime, 0);
  }, [selection.selectedTopics]);

  // Reset All
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
    // Data
    grades,
    availableLessons,
    availableUnits,
    selection,
    
    // Loading states
    isLoadingGrades,
    gradesError,
    
    // Computed
    totalQuestions: getTotalQuestions(),
    totalTime: getTotalTime(),
    canStartTest: selection.selectedTopics.length > 0,
    
    // Actions
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
