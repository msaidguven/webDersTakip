'use client';

import { useState, useCallback } from 'react';
import { Grade, Lesson, Unit, Topic, SelectionStep, HomeSelectionState } from '../models/homeTypes';
import { grades, getLessonsByGrade, getUnitsByLesson } from '../data/homeMockData';

export function useHomeViewModel() {
  const [selection, setSelection] = useState<HomeSelectionState>({
    step: 'grade',
    selectedGrade: null,
    selectedLesson: null,
    selectedUnit: null,
    selectedTopics: [],
  });

  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

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
