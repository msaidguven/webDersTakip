'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardData, Stat } from '../models/types';
import { useAuth } from '../context/AuthContext';
import { getDashboardUnitsData, getUnitsForLesson } from '../lib/dashboardUnits';
import { getDueSrsCount, buildSrsReview } from '../lib/dashboardSrs';
import { getRecentActivities } from '../lib/dashboardActivities';
import { getTodayStats, getOverallStats } from '../lib/dashboardStats';
import { getCurrentStreak, getTodayQuestionCount, getWeeklyActiveDays, DAILY_GOAL_QUESTIONS } from '../lib/dashboardStreak';
import { onQuizModalClosed } from '../lib/panelRefreshBridge';

const EMPTY_STATS: Stat[] = [
  { id: 'total-today', icon: 'help-circle', iconColor: 'indigo', value: 0, label: 'Toplam Soru' },
  { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: 0, label: 'Doğru Cevap' },
  { id: 'wrong-today', icon: 'x-circle', iconColor: 'rose', value: 0, label: 'Yanlış Cevap' },
  { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: 0, label: 'Dakika' },
  { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: '0%', label: 'Başarı Oranı' },
  { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: 0, label: 'Tekrar Gerekli' },
];

const EMPTY_WEEKLY_ACTIVE_DAYS: boolean[] = new Array(7).fill(false);

// Hiçbir alanda mock/uydurma veri kullanılmaz — bu, kullanıcı verisi henüz gelmeden önceki
// (veya hiç kimlik doğrulaması yokken) tamamen boş/nötr başlangıç durumudur. Sayfa bu durumu
// bölüm bazlı iskeletlerle karşılar (bkz. useDashboardViewModel dönüşündeki isXLoading
// flag'leri), gerçek veri gelmeden asla kalıcı içerikmiş gibi gösterilmez.
const EMPTY_DASHBOARD_DATA: DashboardData = {
  user: { id: '', name: '', email: '', streak: 0, dailyGoal: DAILY_GOAL_QUESTIONS, dailyProgress: 0 },
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
  isAuthenticated: boolean;
  notificationCount: number;
  unitsContext: { lessonName: string | null; gradeName: string | null } | null;
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
  selectLesson: (lessonId: string) => void;
  handleSRSReview: () => void;
  handleStartQuiz: () => void;
  refreshData: (options?: { silent?: boolean }) => Promise<void>;
  markNotificationRead: () => void;
}

export function useDashboardViewModel(): UseDashboardViewModelReturn {
  const { user, loading: authLoading, supabase } = useAuth();
  const router = useRouter();

  // State
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
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
  // refreshData "sessiz" (silent) modda çağrıldığında true olur: aşağıdaki effect, bölüm
  // bazlı isXLoading flag'lerini true'ya çekmeyip eski veriyi ekranda tutarak arka planda
  // yeniler — quiz modalı kapanınca sayfa skeleton'lara dönüp "duraklamış" hissi vermesin diye
  // (bkz. kullanıcının "sayfayı duraklatmayacak şekilde hızlıca yenilensin" isteği, 2026-09-02).
  const silentRefreshRef = useRef(false);

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
    // Bağımlılık dizisi user.id'ye bakıyor, ham user nesnesine değil: AuthContext sekme
    // odağa her geldiğinde (bkz. visibilitychange senkronizasyonu) getSession() ile YENİ bir
    // user nesnesi üretiyor, aynı kullanıcı için bile referans değişiyor — user'ı doğrudan
    // bağımlılıkta tutmak, sekme değiştirip panele her dönüşte tüm veriyi (üniteler, istatistik,
    // aktiviteler...) gereksiz yere sıfırdan çektirip panelin "yeniden yükleniyormuş" gibi
    // görünmesine yol açıyordu.
    if (!user) {
      // Çıkış yapıldığında önceki kullanıcının verisi (isim, ünite, istatistik...)
      // yeni bir fetch tetiklenene kadar state'te kalıp isAuthenticated=false
      // ekranıyla birlikte yanlışlıkla gösterilebiliyordu — burada sıfırlanıyor.
      setData(EMPTY_DASHBOARD_DATA);
      setUnitsContext(null);
      setUnitsGradeId(null);
      setIsProfileLoading(true);
      setIsUnitsLoading(true);
      setIsStatsLoading(true);
      setIsActivityLoading(true);
      setIsOverallLoading(true);
      return;
    }

    let cancelled = false;
    const userId = user.id;

    const silent = silentRefreshRef.current;
    silentRefreshRef.current = false;
    if (!silent) {
      setIsProfileLoading(true);
      setIsUnitsLoading(true);
      setIsStatsLoading(true);
      setIsActivityLoading(true);
      setIsOverallLoading(true);
    }

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

    // Üniteler + konular — en ağır zincir, kendi bölümünü (Üniteler) bağımsız günceller.
    profileGradeId.then((gradeId) =>
      getDashboardUnitsData(supabase, userId, gradeId).then((unitsResult) => {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          units: unitsResult?.units ?? [],
          activeUnitId: unitsResult?.activeUnitId ?? null,
          topicsByUnitId: unitsResult?.topicsByUnitId ?? {},
          lessons: unitsResult?.lessons ?? [],
          selectedLessonId: unitsResult?.selectedLessonId ?? null,
        }));
        setUnitsContext(unitsResult ? { lessonName: unitsResult.lessonName, gradeName: unitsResult.gradeName } : null);
        // unitsResult, hiç test_sessions kaydı yoksa null döner (bkz. getDashboardUnitsData) —
        // ama selectLesson (sidebar'dan ders seçimi) yine de bir gradeId'ye ihtiyaç duyuyor.
        // Test oturumu hiç yokken bunu null bırakmak, sidebar'daki derslere tıklamayı
        // sessizce no-op yapıyordu; profildeki grade_id zaten Sidebar'ın kendisinin de
        // kullandığı kaynak olduğu için burada da güvenli bir fallback.
        setUnitsGradeId(unitsResult?.gradeId ?? gradeId ?? null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase, refreshKey]);

  // Actions

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
        setUnitsContext({ lessonName: result.lessonName, gradeName: result.gradeName });
        setData((prev) => ({
          ...prev,
          units: result.units,
          activeUnitId: result.activeUnitId,
          topicsByUnitId: result.topicsByUnitId,
          selectedLessonId: lessonId,
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

  const refreshData = useCallback(async (options?: { silent?: boolean }) => {
    silentRefreshRef.current = options?.silent ?? false;
    setRefreshKey((k) => k + 1);
  }, []);

  // Quiz modalı (X / Escape / backdrop ile) kapanınca panel verisini sessizce tazele —
  // bkz. panelRefreshBridge, modal ayrı bir route ağacında olduğu için doğrudan callback
  // geçirilemiyor.
  useEffect(() => {
    return onQuizModalClosed(() => {
      refreshData({ silent: true });
    });
  }, [refreshData]);

  const markNotificationRead = useCallback(() => {
    setNotificationCount(0);
  }, []);

  return {
    // State
    data,
    isAuthenticated: !!user,
    unitsContext,
    notificationCount,
    isSwitchingLesson,
    isAuthResolving: authLoading,
    isProfileLoading,
    isUnitsLoading,
    isStatsLoading,
    isActivityLoading,
    isOverallLoading,

    // Actions
    selectLesson,
    handleSRSReview,
    handleStartQuiz,
    refreshData,
    markNotificationRead,
  };
}
