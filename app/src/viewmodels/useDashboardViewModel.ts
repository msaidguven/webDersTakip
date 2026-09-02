'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardData, Stat } from '../models/types';
import { useAuth } from '../context/AuthContext';
import { getDashboardUnitsData, getUnitsForLesson, buildWeekWindow } from '../lib/dashboardUnits';
import { getDueSrsCount, buildSrsReview } from '../lib/dashboardSrs';
import { getRecentActivities } from '../lib/dashboardActivities';
import { getTodayStats } from '../lib/dashboardStats';
import { getCurrentStreak, getTodayQuestionCount, DAILY_GOAL_QUESTIONS } from '../lib/dashboardStreak';

const EMPTY_STATS: Stat[] = [
  { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: 0, label: 'Doğru Cevap' },
  { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: 0, label: 'Dakika' },
  { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: '0%', label: 'Başarı Oranı' },
  { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: 0, label: 'Tekrar Gerekli' },
];

const DEFAULT_TOTAL_WEEKS = 38;

// Hiçbir alanda mock/uydurma veri kullanılmaz — bu, kullanıcı verisi henüz gelmeden önceki
// (veya hiç kimlik doğrulaması yokken) tamamen boş/nötr başlangıç durumudur. Sayfa bu durumu
// bir yükleme göstergesiyle karşılar (bkz. useDashboardViewModel dönüşündeki isLoading),
// gerçek veri gelmeden asla kalıcı içerikmiş gibi gösterilmez.
const EMPTY_DASHBOARD_DATA: DashboardData = {
  user: { id: '', name: '', email: '', streak: 0, dailyGoal: DAILY_GOAL_QUESTIONS, dailyProgress: 0 },
  weeks: [],
  currentWeekId: 0,
  stats: EMPTY_STATS,
  srsReview: null,
  units: [],
  recentActivities: [],
  activeUnitId: null,
  activeUnitTitle: null,
  activeUnitTopics: [],
  lessons: [],
  selectedLessonId: null,
};

interface UseDashboardViewModelReturn {
  // State
  data: DashboardData;
  selectedWeekId: number;
  isLoading: boolean;
  isAuthenticated: boolean;
  notificationCount: number;
  unitsContext: { lessonName: string | null; gradeName: string | null } | null;
  canShiftWeekWindow: { prev: boolean; next: boolean };
  isSwitchingLesson: boolean;

  // Actions
  selectWeek: (weekId: number) => void;
  shiftWeekWindow: (direction: 1 | -1) => void;
  selectLesson: (lessonId: string) => void;
  handleSRSReview: () => void;
  handleStartQuiz: () => void;
  refreshData: () => Promise<void>;
  markNotificationRead: () => void;
}

export function useDashboardViewModel(): UseDashboardViewModelReturn {
  const { user, loading: authLoading, supabase } = useAuth();
  const router = useRouter();

  // State
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [selectedWeekId, setSelectedWeekId] = useState<number>(0);
  const [weekWindowStart, setWeekWindowStart] = useState<number>(1);
  const [totalWeeks, setTotalWeeks] = useState<number>(DEFAULT_TOTAL_WEEKS);
  // Sadece "kullanıcı varsa panel verisini çekiyor muyuz" durumunu tutar — kimliği henüz
  // bilinmiyorsa (authLoading) veya kullanıcı yoksa aşağıdaki isLoading zaten bunu kapsar,
  // bu state o durumlarda hiç okunmaz.
  const [isFetching, setIsFetching] = useState(true);
  // DB'de bir bildirim tablosu/sistemi yok — sahte bir sayı göstermek yerine gerçek (boş)
  // durum olan 0'dan başlıyor. Bildirimler gerçek bir kaynağa bağlanana kadar hep 0 kalacak.
  const [notificationCount, setNotificationCount] = useState(0);
  const [unitsContext, setUnitsContext] = useState<{ lessonName: string | null; gradeName: string | null } | null>(null);
  // selectLesson'ın hangi sınıf için ünite çekeceğini bilmesi için — profildeki grade_id
  // boş olabileceğinden (bkz. getDashboardUnitsData) test_sessions'tan türetilen gerçek
  // sınıf id'si ayrıca tutuluyor.
  const [unitsGradeId, setUnitsGradeId] = useState<number | null>(null);
  const [isSwitchingLesson, setIsSwitchingLesson] = useState(false);
  // refreshData tarafından artırılır — efekt buna da bağlı olduğu için manuel yenileme,
  // effect'i kopyalamadan aynı yükleme mantığını tekrar çalıştırır.
  const [refreshKey, setRefreshKey] = useState(0);

  // Kullanıcı adı, üniteler, hafta kartları, SRS tekrar sayısı, son aktiviteler, stats satırı ve
  // streak/günlük hedef: gerçek veri. Streak, user_time_based_stats'taki ardışık aktif günlerden
  // türetiliyor (bkz. dashboardStreak.ts) — ayrı bir tablo gerekmedi.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadRealData() {
      setIsFetching(true);
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

        const nextTotalWeeks = unitsResult?.totalWeeks ?? DEFAULT_TOTAL_WEEKS;
        const nextWindowStart = Math.max(1, (unitsResult?.currentWeek ?? 1) - 1);
        setTotalWeeks(nextTotalWeeks);
        setWeekWindowStart(nextWindowStart);

        setData((prev) => ({
          ...prev,
          user: {
            ...prev.user,
            name: fullName || 'Öğrenci',
            streak,
            dailyGoal: DAILY_GOAL_QUESTIONS,
            dailyProgress: todayQuestionCount,
          },
          units: unitsResult?.units ?? [],
          activeUnitId: unitsResult?.activeUnitId ?? null,
          activeUnitTitle: unitsResult?.activeUnitTitle ?? null,
          activeUnitTopics: unitsResult?.activeUnitTopics ?? [],
          lessons: unitsResult?.lessons ?? [],
          selectedLessonId: unitsResult?.selectedLessonId ?? null,
          weeks: unitsResult ? buildWeekWindow(nextWindowStart, unitsResult.currentWeek, nextTotalWeeks) : prev.weeks,
          currentWeekId: unitsResult?.currentWeek ?? prev.currentWeekId,
          srsReview: buildSrsReview(dueSrsCount),
          recentActivities,
          stats,
        }));
        if (unitsResult) setSelectedWeekId(unitsResult.currentWeek);
        setUnitsContext(
          unitsResult ? { lessonName: unitsResult.lessonName, gradeName: unitsResult.gradeName } : null
        );
        setUnitsGradeId(unitsResult?.gradeId ?? null);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    loadRealData();

    return () => {
      cancelled = true;
    };
  }, [user, supabase, refreshKey]);

  // Kimlik henüz belli değilse (authLoading) ya da kullanıcı var ve veri çekimi sürüyorsa
  // yükleniyor sayılır; kullanıcı hiç yoksa (misafir) çekilecek bir şey olmadığı için
  // isFetching'in bayat değeri hiç etkilemez.
  const isLoading = authLoading || (!!user && isFetching);

  // Actions
  const selectWeek = useCallback((weekId: number) => {
    const week = data.weeks.find(w => w.id === weekId);
    if (week && week.status !== 'locked') {
      setSelectedWeekId(weekId);
    }
  }, [data.weeks]);

  // Haftalık ilerleme kartındaki ok butonları: müfredat haftası penceresini ±5 kaydırır.
  // Saf tarih hesabı olduğu için (buildWeekWindow) yeniden DB'ye gitmeye gerek yok.
  const shiftWeekWindow = useCallback((direction: 1 | -1) => {
    setWeekWindowStart((prevStart) => {
      const maxStart = Math.max(1, totalWeeks - 4);
      const nextStart = Math.max(1, Math.min(maxStart, prevStart + direction * 5));
      setData((prev) => ({ ...prev, weeks: buildWeekWindow(nextStart, prev.currentWeekId, totalWeeks) }));
      return nextStart;
    });
  }, [totalWeeks]);

  const canShiftWeekWindow = {
    prev: weekWindowStart > 1,
    next: weekWindowStart + 5 <= totalWeeks,
  };

  // Hızlı art arda sekme tıklamalarında, eski (geç dönen) bir isteğin sonucu yeni seçilen
  // dersin üstüne yazmasın diye — her çağrı kendi id'sini damgalar, sadece EN SON çağrı
  // sonucu uygulanır.
  const lessonRequestRef = useRef(0);

  // Panelin ders sekmelerinden birine tıklayınca: aynı sınıf içinde, sadece o dersin
  // ünite listesini/aktif konu ilerlemesini yeniden çeker (test_sessions'a hiç dokunmaz —
  // "en son pratik yapılan ders" varsayımı sadece İLK yüklemede kullanılıyor).
  const selectLesson = useCallback((lessonId: string) => {
    if (!user || !unitsGradeId || lessonId === data.selectedLessonId) return;
    const numericLessonId = Number(lessonId);
    if (!Number.isFinite(numericLessonId)) return;

    const requestId = ++lessonRequestRef.current;
    setIsSwitchingLesson(true);
    getUnitsForLesson(supabase, user.id, numericLessonId, unitsGradeId)
      .then((result) => {
        if (lessonRequestRef.current !== requestId) return;
        const nextWindowStart = Math.max(1, result.currentWeek - 1);
        setTotalWeeks(result.totalWeeks);
        setWeekWindowStart(nextWindowStart);
        setSelectedWeekId(result.currentWeek);
        setUnitsContext({ lessonName: result.lessonName, gradeName: result.gradeName });
        setData((prev) => ({
          ...prev,
          units: result.units,
          activeUnitId: result.activeUnitId,
          activeUnitTitle: result.activeUnitTitle,
          activeUnitTopics: result.activeUnitTopics,
          selectedLessonId: lessonId,
          weeks: buildWeekWindow(nextWindowStart, result.currentWeek, result.totalWeeks),
          currentWeekId: result.currentWeek,
        }));
      })
      .finally(() => {
        if (lessonRequestRef.current === requestId) setIsSwitchingLesson(false);
      });
  }, [user, supabase, unitsGradeId, data.selectedLessonId]);

  const handleSRSReview = useCallback(() => {
    router.push('/tekrar');
  }, [router]);

  const handleStartQuiz = useCallback(() => {
    router.push('/');
  }, [router]);

  const refreshData = useCallback(async () => {
    setRefreshKey((k) => k + 1);
  }, []);

  const markNotificationRead = useCallback(() => {
    setNotificationCount(0);
  }, []);

  return {
    // State
    data,
    selectedWeekId,
    isLoading,
    isAuthenticated: !!user,
    unitsContext,
    notificationCount,
    canShiftWeekWindow,
    isSwitchingLesson,

    // Actions
    selectWeek,
    shiftWeekWindow,
    selectLesson,
    handleSRSReview,
    handleStartQuiz,
    refreshData,
    markNotificationRead,
  };
}
