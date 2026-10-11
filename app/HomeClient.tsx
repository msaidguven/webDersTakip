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
import { HomeHero } from './src/components/home/HomeHero';
import { GradeLessonPicker } from './src/components/home/GradeLessonPicker';
import { RecentTopicsCard, SchoolThisWeekCard } from './src/components/home/HomeHighlightCards';
import { AboutSite } from './src/components/home/AboutSite';
import { StudentToday } from './src/components/home/StudentToday';
import { DailyQuestionOfTheDay } from './src/components/home/DailyQuestionCard';
import { TopStudents } from './src/components/home/TopStudents';
import type { TopStudentEntry } from './src/lib/leaderboard';
import { fetchMyProfile } from '@/app/src/lib/myProfileClient';

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
}

export default function HomeClient({ initialGrades, stats, gradeSections, topStudents, dailyQuestionSets, recentTopics, recentByGrade, thisWeek }: HomeClientProps) {
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
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyProfile(user.id)
      .then((data: { profile: { grade_id: number | null } | null } | null) => {
        if (cancelled || hasManualSelectionRef.current) return;
        const gradeId = data?.profile?.grade_id;
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

  const handleSelectGrade = (gradeId: string) => {
    hasManualSelectionRef.current = true;
    setSelectedGradeId(gradeId);
  };

  // Anasayfa düzeni (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
  // ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Kırık beyaz zemin, beyaz ince çerçeveli
  // kartlar, tek vurgu rengi (indigo) butonlarda; bölümler arasında ince ayırıcı çizgi.
  //  - Misafir: giriş + Günün Sorusu → [Dersler | Okulda bu hafta] → [Yeni eklenenler | Bu
  //    haftanın en çalışkanları] → Ders Takip nedir? + üyelik kartı.
  //  - Girişli (2026-10-11 sadeleştirme, bkz. StudentToday.tsx): görev kartı + Derslerim | Günün
  //    sorusu → "Bir de bunlara bak" (sıralama / okulda bu hafta / yeni konular yerinde açılır).
  //  Takvim verisi olmayan sınıfta "Okulda bu hafta" kartı yok → Dersler tam genişlik.
  //  Sunucu HTML'i (ISR) her zaman misafir hali — Google onu görür.
  const thisWeekTopics = selectedGrade ? thisWeek.byGradeId[selectedGrade.id] ?? [] : [];
  const thisWeekCard = selectedGrade ? <SchoolThisWeekCard gradeName={selectedGrade.name} week={thisWeek.week} topics={thisWeekTopics} /> : null;
  const hasThisWeek = thisWeekTopics.length > 0;
  // Günün sorusu seçili sınıftan (girişlide profildeki sınıf); o sınıfın seti yoksa ilk mevcut set.
  const dailyQuestionSet = (selectedGrade && dailyQuestionSets[selectedGrade.id]) || Object.values(dailyQuestionSets)[0] || null;
  const recent = isAuthenticated && selectedGrade ? recentByGrade[selectedGrade.id] ?? [] : recentTopics;

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] dark:bg-background">
        <main className="px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
          <div className="mx-auto max-w-5xl">
            <StudentToday
              dailyQuestion={
                dailyQuestionSet && (
                  <div id="gunun-sorusu-bolumu" className="scroll-mt-24">
                    <DailyQuestionOfTheDay set={dailyQuestionSet} />
                  </div>
                )
              }
              thisWeek={hasThisWeek ? { label: `${thisWeek.week}. hafta`, panel: thisWeekCard } : undefined}
              recent={recent.length > 0 ? { label: `${recent.length} yeni`, panel: <RecentTopicsCard topics={recent} gradeName={selectedGrade?.name} /> } : undefined}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-background">
      <main className="px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 sm:gap-14 [&>*+*]:border-t [&>*+*]:border-default [&>*+*]:pt-12 sm:[&>*+*]:pt-14">
          <HomeHero isAuthenticated={false} gradeLevels={resolvedGrades.map((g) => g.level)} stats={stats} dailyQuestionSet={dailyQuestionSet} />

          {selectedGrade && (
            <GradeLessonPicker
              grades={resolvedGrades}
              selectedGrade={selectedGrade}
              section={gradeSections[selectedGrade.id]}
              onSelect={handleSelectGrade}
              aside={hasThisWeek ? thisWeekCard : undefined}
            />
          )}

          {recent.length > 0 && <RecentTopicsCard topics={recent} gradeName={null} />}

          {/* Son satır: "Ders Takip nedir?" (+üyelik), yanında sıralama. */}
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <AboutSite gradeLevels={resolvedGrades.map((g) => g.level)} stats={stats} />
            <TopStudents students={topStudents} isAuthenticated={false} />
          </div>
        </div>
      </main>
    </div>
  );
}
