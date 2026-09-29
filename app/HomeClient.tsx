'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { useAuth } from './src/context/AuthContext';
import { Grade } from './src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from './src/lib/homeMapping';
import type { HomeGradeSection, SiteStats } from './src/lib/homeStats';
import type { DailyQuestion, RecentTopicItem, ThisWeekTopicItem } from './src/lib/homeHighlights';
import { HomeHero } from './src/components/home/HomeHero';
import { GradeLessonPicker } from './src/components/home/GradeLessonPicker';
import { ThisWeekSection } from './src/components/home/ThisWeekSection';
import { JoinBand } from './src/components/home/JoinBand';
import { AboutSite } from './src/components/home/AboutSite';
import { StudentToday } from './src/components/home/StudentToday';
import { DailyQuestionCard } from './src/components/home/DailyQuestionCard';
import { TopStudents } from './src/components/home/TopStudents';
import type { TopStudentEntry } from './src/lib/leaderboard';

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
  dailyQuestion: DailyQuestion | null;
  recentTopics: RecentTopicItem[];
  thisWeekByGrade: Record<string, ThisWeekTopicItem[]>;
  topStudents: TopStudentEntry[];
}

export default function HomeClient({ initialGrades, stats, gradeSections, topStudents, dailyQuestion, recentTopics, thisWeekByGrade }: HomeClientProps) {
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
    fetch('/api/profile/update')
      .then((res) => (res.ok ? res.json() : null))
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

  // Sade anasayfa (2026-09-27 taslağı, yol haritası 2c + 3a).
  //  - Misafir: hero + Günün Sorusu → sınıf/ders → Bu hafta → sıralama → tek üyelik bandı.
  //  - Girişli öğrenci ("Bugün"): tek görev + günlük hedef/seri/sıra + Derslerim (StudentToday,
  //    kişisel veri tarayıcıda) → Bu hafta (kendi sınıfı) → Günün Sorusu. Derin analiz
  //    "İlerlemem" sayfasında (yol haritası 4); burada tekrar edilmiyor.
  //  Sunucu HTML'i (ISR) her zaman misafir hali — Google onu görür; girişli görünüm oturum
  //  açıldıktan sonra tarayıcıda geçer.
  return (
    <div className="min-h-screen bg-background">
      <main className="px-4 py-8 sm:px-8 sm:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-14 sm:gap-20">
          {isAuthenticated ? (
            <StudentToday />
          ) : (
            <HomeHero
              isAuthenticated={false}
              gradeLevels={resolvedGrades.map((g) => g.level)}
              stats={stats}
              dailyQuestion={dailyQuestion}
            />
          )}

          {!isAuthenticated && selectedGrade && (
            <GradeLessonPicker
              grades={resolvedGrades}
              selectedGrade={selectedGrade}
              section={gradeSections[selectedGrade.id]}
              onSelect={handleSelectGrade}
            />
          )}

          {selectedGrade && (
            <ThisWeekSection gradeName={selectedGrade.name} thisWeek={thisWeekByGrade[selectedGrade.id] ?? []} recent={recentTopics} />
          )}

          {isAuthenticated && dailyQuestion && (
            <div id="gunun-sorusu-bolumu" className="scroll-mt-24 lg:max-w-2xl">
              <DailyQuestionCard data={dailyQuestion} />
            </div>
          )}

          {!isAuthenticated && <TopStudents students={topStudents} isAuthenticated={false} />}

          {!isAuthenticated && <AboutSite gradeLevels={resolvedGrades.map((g) => g.level)} stats={stats} />}

          {!isAuthenticated && <JoinBand />}
        </div>
      </main>
    </div>
  );
}
