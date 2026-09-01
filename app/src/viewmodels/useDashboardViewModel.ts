'use client';

import { useState, useCallback, useEffect } from 'react';
import { DashboardData, Week, Unit, Activity } from '../models/types';
import { mockDashboardData } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { getDashboardUnitsData, buildWeekWindow } from '../lib/dashboardUnits';
import { getDueSrsCount, buildSrsReview } from '../lib/dashboardSrs';
import { getRecentActivities } from '../lib/dashboardActivities';
import { getTodayStats } from '../lib/dashboardStats';
import { getCurrentStreak, getTodayQuestionCount, DAILY_GOAL_QUESTIONS } from '../lib/dashboardStreak';

interface UseDashboardViewModelReturn {
  // State
  data: DashboardData;
  selectedWeekId: number;
  isLoading: boolean;
  notificationCount: number;
  unitsContext: { lessonName: string | null; gradeName: string | null } | null;

  // Actions
  selectWeek: (weekId: number) => void;
  handleUnitClick: (unitId: string) => void;
  handleSRSReview: () => void;
  handleStartQuiz: () => void;
  refreshData: () => Promise<void>;
  markNotificationRead: () => void;
}

export function useDashboardViewModel(): UseDashboardViewModelReturn {
  const { user, supabase } = useAuth();

  // State
  const [data, setData] = useState<DashboardData>({
    ...mockDashboardData,
    user: { ...mockDashboardData.user, name: 'Öğrenci', streak: 0, dailyGoal: DAILY_GOAL_QUESTIONS, dailyProgress: 0 },
    units: [],
    srsReview: null,
    recentActivities: [],
    stats: [
      { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: 0, label: 'Doğru Cevap' },
      { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: 0, label: 'Dakika' },
      { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: '0%', label: 'Başarı Oranı' },
      { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: 0, label: 'Tekrar Gerekli' },
    ],
  });
  const [selectedWeekId, setSelectedWeekId] = useState<number>(mockDashboardData.currentWeekId);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);
  const [unitsContext, setUnitsContext] = useState<{ lessonName: string | null; gradeName: string | null } | null>(null);

  // Kullanıcı adı, üniteler, hafta kartları, SRS tekrar sayısı, son aktiviteler, stats satırı ve
  // streak/günlük hedef: gerçek veri. Streak, user_time_based_stats'taki ardışık aktif günlerden
  // türetiliyor (bkz. dashboardStreak.ts) — ayrı bir tablo gerekmedi. Haftaya tıklama /
  // "Şimdi Tekrar Et" davranışı ve sosyal/lider tablosu katmanı henüz yok (bkz.
  // docs/site-iyilestirme-plani.md madde 3).
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadRealData() {
      setIsLoading(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, grade_id')
          .eq('id', user!.id)
          .maybeSingle();

        const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;
        const fullName = (profile as { full_name: string | null } | null)?.full_name ?? null;

        const [unitsResult, dueSrsCount, recentActivities, streak, todayQuestionCount] = await Promise.all([
          getDashboardUnitsData(supabase, user!.id, gradeId),
          getDueSrsCount(supabase, user!.id, gradeId),
          getRecentActivities(supabase, user!.id),
          getCurrentStreak(supabase, user!.id),
          getTodayQuestionCount(supabase, user!.id),
        ]);
        const stats = await getTodayStats(supabase, user!.id, dueSrsCount);

        if (cancelled) return;

        setData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            name: fullName || prev.user.name,
            streak,
            dailyGoal: DAILY_GOAL_QUESTIONS,
            dailyProgress: todayQuestionCount,
          },
          units: unitsResult?.units ?? [],
          weeks: unitsResult ? buildWeekWindow(unitsResult.currentWeek, unitsResult.totalWeeks) : prev.weeks,
          currentWeekId: unitsResult?.currentWeek ?? prev.currentWeekId,
          srsReview: buildSrsReview(dueSrsCount),
          recentActivities,
          stats,
        }));
        if (unitsResult) setSelectedWeekId(unitsResult.currentWeek);
        setUnitsContext(
          unitsResult ? { lessonName: unitsResult.lessonName, gradeName: unitsResult.gradeName } : null
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadRealData();

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

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
    unitsContext,
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
