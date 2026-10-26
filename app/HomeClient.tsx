'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { useAuth } from './src/context/AuthContext';
import { Grade } from './src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from './src/lib/homeMapping';
import type { HomeGradeSection, SiteStats } from './src/lib/homeStats';
import type { DailyQuestionSet, RecentTopicItem, ThisWeekTopicItem } from './src/lib/homeHighlights';
import { RecentTopicsCard, SchoolThisWeekCard } from './src/components/home/HomeHighlightCards';
import { StudentToday } from './src/components/home/StudentToday';
import { DailyQuestionOfTheDay } from './src/components/home/DailyQuestionCard';
import type { TopStudentEntry } from './src/lib/leaderboard';
import { fetchMyProfile } from '@/app/src/lib/myProfileClient';
import { UpcomingExamsCard, type UpcomingExam } from './src/components/yazili/UpcomingExamsCard';
import { GuestHomeV1 } from './src/components/home/GuestHomeV1';
import { TeacherHome } from './src/components/home/TeacherHome';
import { AdminHome, PreviewBanner, type HomePreview } from './src/components/home/AdminHome';
import { roboticFontVars } from './src/components/robotic/fonts';
import r from './src/components/robotic/robotic.module.css';

interface GradeRow {
  id: number;
  name: string;
  order_no: number;
  is_active: boolean;
  slug: string;
}

const fetcher = async (): Promise<Grade[]> => {
  logger.log('[HomeClient fetcher] Siniflar cekiliyor...');
  const supabase = createClient();

  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active, slug')
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  if (error) {
    logger.error('[HomeClient fetcher] HATA:', error);
    throw error;
  }

  const gradeRows = (data as GradeRow[] | null) || [];
  return gradeRows.map((g) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    slug: g.slug || `${g.order_no}-sinif`,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));
};

interface HomeClientProps {
  initialGrades: Grade[];
  stats: SiteStats;
  gradeSections: Record<string, HomeGradeSection>;
  // grade_id → haftalık 7 soruluk set (bkz. getDailyQuestionSetsByGrade).
  dailyQuestionSets: Record<string, DailyQuestionSet>;
  recentTopics: RecentTopicItem[];
  recentByGrade: Record<string, RecentTopicItem[]>;
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
  topStudents: TopStudentEntry[];
  upcomingExamsByGrade: Record<string, UpcomingExam[]>;
}

export default function HomeClient({ initialGrades, stats, gradeSections, topStudents, dailyQuestionSets, recentTopics, recentByGrade, thisWeek, upcomingExamsByGrade }: HomeClientProps) {
  const { isAuthenticated, user } = useAuth();
  const { data: grades } = useSWR('grades', fetcher, {
    fallbackData: initialGrades,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  const resolvedGrades = useMemo(() => grades || [], [grades]);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(resolvedGrades[0]?.id ?? null);
  const selectedGrade = useMemo(
    () => resolvedGrades.find((g) => g.id === selectedGradeId) ?? resolvedGrades[0] ?? null,
    [resolvedGrades, selectedGradeId]
  );

  // Sekmeler (ve dolayısıyla "Soru Bankası" kısayolu) varsayılan olarak İLK sınıfa (5. Sınıf)
  // düşüyordu — giriş yapmış bir 6/7/8. sınıf öğrencisi hiç sekme değiştirmeden "Soru
  // Bankası"na tıklarsa kendi sınıfı yerine 5. Sınıf'a gidiyordu (kullanıcının 2026-09-06
  // bildirdiği bug). Profildeki grade_id varsa (bkz. useSidebarLessons.ts'teki aynı desen)
  // sekme seçimini SESSİZCE ona göre başlatıyoruz — kullanıcı zaten manuel bir sekmeye
  // bastıysa (hasManualSelectionRef) üzerine yazmıyoruz.
  const hasManualSelectionRef = useRef(false);
  // Anasayfa role göre ayrılır (2026-10-22): öğrenci → StudentToday, öğretmen → öğretmen paneli, admin →
  // yönetim anasayfası (+ öğrenci/öğretmen önizlemesi). Rol aynı profil isteğinden gelir, ek sorgu yok.
  const [me, setMe] = useState<{ userId: string; role: string | null; firstName: string | null; isVerified: boolean } | null>(null);
  const [preview, setPreview] = useState<HomePreview | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyProfile(user.id)
      .then((data: { profile: { grade_id: number | null; role: string | null; full_name: string | null; is_verified: boolean | null } | null } | null) => {
        if (cancelled) return;
        const p = data?.profile;
        setMe({ userId: user.id, role: p?.role ?? null, firstName: p?.full_name?.trim().split(/\s+/)[0] || null, isVerified: !!p?.is_verified });
        if (hasManualSelectionRef.current) return;
        const gradeId = p?.grade_id;
        if (gradeId != null) setSelectedGradeId(String(gradeId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // user (nesne) yerine user?.id: AuthContext sekme odağa her geldiğinde yeni bir user
    // nesnesi üretiyor, aynı kullanıcı için bile referans değişiyor (bkz. useSidebarLessons.ts'teki aynı not).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Anasayfa düzeni (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
  // ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Kırık beyaz zemin, beyaz ince çerçeveli
  // kartlar, tek vurgu rengi (indigo) butonlarda; bölümler arasında ince ayırıcı çizgi.
  //  - Misafir: giriş + Günün Sorusu → [Dersler | Okulda bu hafta] → [Yeni eklenenler | Bu
  //    haftanın en çalışkanları] → Ders Takip nedir? + üyelik kartı.
  //  - Girişli (bkz. StudentToday.tsx): karşılama + hızlı erişim → görev + Derslerim + durum özeti →
  //    Günün sorusu, Okulda bu hafta, Yeni konular (her biri ayrı kart, sekme yok — 2026-10-19).
  //  Takvim verisi olmayan sınıfta "Okulda bu hafta" kartı yok → Dersler tam genişlik.
  //  Sunucu HTML'i (ISR) her zaman misafir hali — Google onu görür.
  const thisWeekTopics = selectedGrade ? thisWeek.byGradeId[selectedGrade.id] ?? [] : [];
  const thisWeekCard = selectedGrade ? <SchoolThisWeekCard gradeName={selectedGrade.name} week={thisWeek.week} topics={thisWeekTopics} /> : null;
  const hasThisWeek = thisWeekTopics.length > 0;
  // Günün sorusu seçili sınıftan (girişlide profildeki sınıf); o sınıfın seti yoksa ilk mevcut set.
  const dailyQuestionSet = (selectedGrade && dailyQuestionSets[selectedGrade.id]) || Object.values(dailyQuestionSets)[0] || null;
  const recent = isAuthenticated && selectedGrade ? recentByGrade[selectedGrade.id] ?? [] : recentTopics;

  if (isAuthenticated) {
    const profile = me && me.userId === user?.id ? me : null;
    const view = !profile ? null : profile.role === 'admin' ? preview ?? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student';
    const allUpcoming = Object.values(upcomingExamsByGrade).flat();
    return (
      <div className={`${roboticFontVars} ${r.root}`}>
        <main className="px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
          <div className="mx-auto max-w-5xl">
            {profile?.role === 'admin' && preview && <PreviewBanner view={preview} onExit={() => setPreview(null)} />}
            {view === null ? (
              <div className={`h-64 animate-pulse rounded-[22px] ${r.panel}`} aria-hidden="true" />
            ) : view === 'admin' ? (
              <AdminHome firstName={profile!.firstName} onPreview={setPreview} />
            ) : view === 'teacher' ? (
              <TeacherHome
                firstName={profile!.firstName}
                isVerified={profile!.role === 'admin' || profile!.isVerified}
                grades={resolvedGrades}
                thisWeek={thisWeek}
                upcomingExams={allUpcoming.length ? <UpcomingExamsCard exams={allUpcoming} className="rounded-[22px]" /> : undefined}
              />
            ) : (
            <StudentToday
              dailyQuestion={
                dailyQuestionSet && (
                  <div id="gunun-sorusu-bolumu" className="scroll-mt-24">
                    <DailyQuestionOfTheDay set={dailyQuestionSet} />
                  </div>
                )
              }
              thisWeek={hasThisWeek ? thisWeekCard : undefined}
              recent={recent.length > 0 ? <RecentTopicsCard topics={recent} gradeName={selectedGrade?.name} /> : undefined}
              upcomingExams={selectedGrade && upcomingExamsByGrade[selectedGrade.id]?.length ? <UpcomingExamsCard exams={upcomingExamsByGrade[selectedGrade.id]} className="rounded-[22px]" /> : undefined}
            />
            )}
          </div>
        </main>
      </div>
    );
  }

  // Misafir anasayfası: v1 (2026-10-19 — tek misafir tasarımı; eski sürümler git geçmişinde).
  return (
    <GuestHomeV1
      grades={resolvedGrades}
      gradeSections={gradeSections}
      stats={stats}
      topStudents={topStudents}
      thisWeek={thisWeek}
      recentByGrade={recentByGrade}
      dailyQuestionSets={dailyQuestionSets}
      upcomingExams={<UpcomingExamsCard exams={Object.values(upcomingExamsByGrade).flat()} />}
    />
  );
}
