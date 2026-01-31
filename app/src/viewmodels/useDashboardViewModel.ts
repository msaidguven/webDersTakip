'use client';

import { useState, useCallback } from 'react';
import { DashboardData, Week, Unit, Activity } from '../models/types';
import { mockDashboardData } from '../data/mockData';

interface UseDashboardViewModelReturn {
  // State
  data: DashboardData;
  selectedWeekId: number;
  isLoading: boolean;
  notificationCount: number;
  
  // Actions
  selectWeek: (weekId: number) => void;
  handleUnitClick: (unitId: string) => void;
  handleSRSReview: () => void;
  handleStartQuiz: () => void;
  refreshData: () => Promise<void>;
  markNotificationRead: () => void;
}

export function useDashboardViewModel(): UseDashboardViewModelReturn {
  // State
  const [data] = useState<DashboardData>(mockDashboardData);
  const [selectedWeekId, setSelectedWeekId] = useState<number>(mockDashboardData.currentWeekId);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);

  // Actions
  const selectWeek = useCallback((weekId: number) => {
    const week = data.weeks.find(w => w.id === weekId);
    if (week && week.status !== 'locked') {
      setSelectedWeekId(weekId);
      // TODO: Load week-specific data when Supabase is integrated
      console.log(`Week ${weekId} selected`);
    }
  }, [data.weeks]);

  const handleUnitClick = useCallback((unitId: string) => {
    const unit = data.units.find(u => u.id === unitId);
    if (unit && unit.status !== 'locked') {
      // TODO: Navigate to unit detail page
      console.log(`Unit ${unitId} clicked`);
    }
  }, [data.units]);

  const handleSRSReview = useCallback(() => {
    // TODO: Navigate to SRS review page
    console.log('SRS Review started');
  }, []);

  const handleStartQuiz = useCallback(() => {
    // TODO: Navigate to quiz start page
    console.log('Quiz started');
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Fetch data from Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Data refreshed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(() => {
    setNotificationCount(0);
  }, []);

  return {
    // State
    data,
    selectedWeekId,
    isLoading,
    notificationCount,
    
    // Actions
    selectWeek,
    handleUnitClick,
    handleSRSReview,
    handleStartQuiz,
    refreshData,
    markNotificationRead,
  };
}
