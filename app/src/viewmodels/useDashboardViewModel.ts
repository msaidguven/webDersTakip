'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardData, Stat } from '../models/types';
import { useAuth } from '../context/AuthContext';
import { getDashboardUnitsData, getUnitsForLesson, buildWeekWindow } from '../lib/dashboardUnits';
import { getDueSrsCount, buildSrsReview } from '../lib/dashboardSrs';
import { getRecentActivities } from '../lib/dashboardActivities';
import { getTodayStats, getOverallStats } from '../lib/dashboardStats';
import { getCurrentStreak, getTodayQuestionCount, getWeeklyActiveDays, DAILY_GOAL_QUESTIONS } from '../lib/dashboardStreak';

const EMPTY_STATS: Stat[] = [
  { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: 0, label: 'Doğru Cevap' },
  { id: 'wrong-today', icon: 'x-circle', iconColor: 'rose', value: 0, label: 'Yanlış Cevap' },
  { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: 0, label: 'Dakika' },
  { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: '0%', label: 'Başarı Oranı' },
  { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: 0, label: 'Tekrar Gerekli' },
];

const EMPTY_WEEKLY_ACTIVE_DAYS: boolean[] = new Array(7).fill(false);

const DEFAULT_TOTAL_WEEKS = 38;

// Hiçbir alanda mock/uydurma veri kullanılmaz — bu, kullanıcı verisi henüz gelmeden önceki
// (veya hiç kimlik doğrulaması yokken) tamamen boş/nötr başlangıç durumudur. Sayfa bu durumu
// bölüm bazlı iskeletlerle karşılar (bkz. useDashboardViewModel dönüşündeki isXLoading
// flag'leri), gerçek veri gelmeden asla kalıcı içerikmiş gibi gösterilmez.
const EMPTY_DASHBOARD_DATA: DashboardData = {
  user: { id: '', name: '', email: '', streak: 0, dailyGoal: DAILY_GOAL_QUESTIONS, dailyProgress: 0 },
  weeks: [],
  currentWeekId: 0,
  weeklyActiveDays: EMPTY_WEEKLY_ACTIVE_DAYS,
  stats: EMPTY_STATS,
  overallStats: null,
  srsReview: null,
  units: [],
  recentActivities: [],
  activeUnitId: null,
  topicsByUnitId: {},
  lessons: [],
  selectedLessonId: null,
};

interface UseDashboardViewModelReturn {
  // State
  data: DashboardData;
  selectedWeekId: number;
  isAuthenticated: boolean;
  notificationCount: number;
  unitsContext: { lessonName: string | null; gradeName: string | null } | null;
  canShiftWeekWindow: { prev: boolean; next: boolean };
  isSwitchingLesson: boolean;
  // Panelin bölüm bazlı yüklenmesi için — hepsi tek bir global spinner yerine, her bölüm
  // kendi verisi gelince ayrı ayrı görünür (bkz. kullanıcıyla "adım adım yüklensin" isteği).
  isAuthResolving: boolean;
  isProfileLoading: boolean;
  isUnitsLoading: boolean;
  isStatsLoading: boolean;
  isActivityLoading: boolean;
  isOverallLoading: boolean;

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
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isUnitsLoading, setIsUnitsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(true);
  const [isOverallLoading, setIsOverallLoading] = useState(true);
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
  //
  // Eskiden TEK bir Promise.all + TEK bir setData ile hepsi birden, en yavaş parça bitene kadar
  // hiçbir şey göstermiyordu. Artık her bölüm kendi promise zincirinde, kendi setData/isXLoading
  // çağrısıyla bağımsız çözülüyor: sadece `getDashboardUnitsData` (üniteler, en ağır zincir) ve
  // `getDueSrsCount`/`getTodayStats` profildeki grade_id'yi bekliyor, geri kalanı (aktiviteler,
  // streak, bugünkü soru sayısı, haftalık aktif günler, genel istatistik) hiç beklemeden hemen başlar.
  useEffect(() => {
    if (!user) {
      // Çıkış yapıldığında önceki kullanıcının verisi (isim, ünite, istatistik...)
      // yeni bir fetch tetiklenene kadar state'te kalıp isAuthenticated=false
      // ekranıyla birlikte yanlışlıkla gösterilebiliyordu — burada sıfırlanıyor.
      setData(EMPTY_DASHBOARD_DATA);
      setUnitsContext(null);
      setUnitsGradeId(null);
      setSelectedWeekId(0);
      setIsProfileLoading(true);
      setIsUnitsLoading(true);
      setIsStatsLoading(true);
      setIsActivityLoading(true);
      setIsOverallLoading(true);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    setIsProfileLoading(true);
    setIsUnitsLoading(true);
    setIsStatsLoading(true);
    setIsActivityLoading(true);
    setIsOverallLoading(true);

    // Profil (isim + grade_id): tek başına en hafif sorgu, isim karşılama başlığında hemen
    // görünsün diye kendi setData'sını hemen yapıyor. gradeId'yi döndürüp aşağıdaki iki dalın
    // (üniteler + srs/bugünkü istatistik) beklemesini sağlıyor — sorgu sadece BİR kez atılıyor,
    // .then() ile birden fazla yerden dinlenmesi tekrar sorgu attırmıyor.
    const profileGradeId = supabase
      .from('profiles')
      .select('full_name, grade_id')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data: profile }) => {
        const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;
        const fullName = (profile as { full_name: string | null } | null)?.full_name ?? null;
        if (!cancelled) {
          setData((prev) => ({ ...prev, user: { ...prev.user, name: fullName || 'Öğrenci' } }));
          setIsProfileLoading(false);
        }
        return gradeId;
      });

    // Üniteler + konular + hafta penceresi — en ağır zincir, kendi bölümünü (Üniteler +
    // Haftalık İlerleme) bağımsız günceller.
    profileGradeId.then((gradeId) =>
      getDashboardUnitsData(supabase, userId, gradeId).then((unitsResult) => {
        if (cancelled) return;
        const nextTotalWeeks = unitsResult?.totalWeeks ?? DEFAULT_TOTAL_WEEKS;
        const nextWindowStart = Math.max(1, (unitsResult?.currentWeek ?? 1) - 1);
        setTotalWeeks(nextTotalWeeks);
        setWeekWindowStart(nextWindowStart);
        setData((prev) => ({
          ...prev,
          units: unitsResult?.units ?? [],
          activeUnitId: unitsResult?.activeUnitId ?? null,
          topicsByUnitId: unitsResult?.topicsByUnitId ?? {},
          lessons: unitsResult?.lessons ?? [],
          selectedLessonId: unitsResult?.selectedLessonId ?? null,
          weeks: unitsResult ? buildWeekWindow(nextWindowStart, unitsResult.currentWeek, nextTotalWeeks) : prev.weeks,
          currentWeekId: unitsResult?.currentWeek ?? prev.currentWeekId,
        }));
        if (unitsResult) setSelectedWeekId(unitsResult.currentWeek);
        setUnitsContext(unitsResult ? { lessonName: unitsResult.lessonName, gradeName: unitsResult.gradeName } : null);
        setUnitsGradeId(unitsResult?.gradeId ?? null);
        setIsUnitsLoading(false);
      })
    );

    // "Bugün" küme: DailyGoalCard + StatsRow + SRSWidget. streak/bugünkü soru sayısı gradeId'ye
    // ihtiyaç duymadığı için hemen başlar; SRS sayısı ve ona bağlı bugünkü istatistikler
    // profildeki gradeId'yi bekler.
    Promise.all([
      Promise.all([getCurrentStreak(supabase, userId), getTodayQuestionCount(supabase, userId)]),
      profileGradeId
        .then((gradeId) => getDueSrsCount(supabase, userId, gradeId))
        .then((dueSrsCount) => getTodayStats(supabase, userId, dueSrsCount).then((stats) => ({ dueSrsCount, stats }))),
    ]).then(([[streak, todayQuestionCount], { dueSrsCount, stats }]) => {
      if (cancelled) return;
      setData((prev) => ({
        ...prev,
        user: { ...prev.user, streak, dailyGoal: DAILY_GOAL_QUESTIONS, dailyProgress: todayQuestionCount },
        srsReview: buildSrsReview(dueSrsCount),
        stats,
      }));
      setIsStatsLoading(false);
    });

    // Haftalık aktif gün noktaları — bağımsız, hazır olunca sessizce state'e yazılır (ayrı bir
    // loading flag'i yok, WeeklyProgress zaten isUnitsLoading'e göre gösteriliyor).
    getWeeklyActiveDays(supabase, userId).then((weeklyActiveDays) => {
      if (!cancelled) setData((prev) => ({ ...prev, weeklyActiveDays }));
    });

    // Panel widget'ı artık sadece yarım kalan testleri gösteriyor (bkz. panel/page.tsx) —
    // varsayılan limit (5) çoğu zaman hiç yarım kalan içermeyebiliyor, biraz daha geniş
    // bir pencereden seçebilsin diye limit artırıldı.
    getRecentActivities(supabase, userId, 12).then((recentActivities) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, recentActivities }));
      setIsActivityLoading(false);
    });

    getOverallStats(supabase, userId).then((overallStats) => {
      if (cancelled) return;
      setData((prev) => ({ ...prev, overallStats }));
      setIsOverallLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, supabase, refreshKey]);

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

  // Panelin ders sekmelerinden/sidebar'dan birine tıklayınca: aynı sınıf içinde, sadece o
  // dersin ünite listesini/konularını yeniden çeker (test_sessions'a hiç dokunmaz —
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
          topicsByUnitId: result.topicsByUnitId,
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
    isAuthenticated: !!user,
    unitsContext,
    notificationCount,
    canShiftWeekWindow,
    isSwitchingLesson,
    isAuthResolving: authLoading,
    isProfileLoading,
    isUnitsLoading,
    isStatsLoading,
    isActivityLoading,
    isOverallLoading,

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
