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
import { RecentTopicsCard, SchoolThisWeekCard } from './src/components/home/HomeHighlightCards';
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
  recentByGrade: Record<string, RecentTopicItem[]>;
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
  topStudents: TopStudentEntry[];
}

export default function HomeClient({ initialGrades, stats, gradeSections, topStudents, dailyQuestion, recentTopics, recentByGrade, thisWeek }: HomeClientProps) {
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

  // Anasayfa düzeni (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
  // ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Kırık beyaz zemin, beyaz ince çerçeveli
  // kartlar, tek vurgu rengi (indigo) butonlarda; bölümler arasında ince ayırıcı çizgi.
  //  - Misafir: giriş + Günün Sorusu → [Dersler | Okulda bu hafta] → [Yeni eklenenler | Bu
  //    haftanın en çalışkanları] → Ders Takip nedir? + üyelik kartı.
  //  - Girişli: Bugünkü görev + günlük hedef → [Derslerim | Okulda bu hafta (kendi sınıfı)] →
  //    [Yeni eklenenler (kendi sınıfı, son 5) | sıralama] → Günün Sorusu.
  //  Takvim verisi olmayan sınıfta "Okulda bu hafta" kartı yok → Dersler tam genişlik.
  //  Sunucu HTML'i (ISR) her zaman misafir hali — Google onu görür.
  const thisWeekCard = selectedGrade ? (
    <SchoolThisWeekCard gradeName={selectedGrade.name} week={thisWeek.week} topics={thisWeek.byGradeId[selectedGrade.id] ?? []} />
  ) : null;
  const hasThisWeek = !!selectedGrade && (thisWeek.byGradeId[selectedGrade.id]?.length ?? 0) > 0;
  const recent = isAuthenticated && selectedGrade ? recentByGrade[selectedGrade.id] ?? [] : recentTopics;

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-background">
      <main className="px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-12 sm:gap-14 [&>*+*]:border-t [&>*+*]:border-default [&>*+*]:pt-12 sm:[&>*+*]:pt-14">
          {isAuthenticated ? (
            <StudentToday lessonsAside={hasThisWeek ? thisWeekCard : undefined} />
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
              aside={hasThisWeek ? thisWeekCard : undefined}
            />
          )}

          {recent.length > 0 && <RecentTopicsCard topics={recent} gradeName={isAuthenticated ? selectedGrade?.name : null} />}

          {/* Son satır: misafirde "Ders Takip nedir?" (+üyelik), girişlide Günün Sorusu — yanında sıralama. */}
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
            {isAuthenticated ? (
              dailyQuestion && (
                <div id="gunun-sorusu-bolumu" className="scroll-mt-24">
                  <DailyQuestionCard data={dailyQuestion} />
                </div>
              )
            ) : (
              <AboutSite gradeLevels={resolvedGrades.map((g) => g.level)} stats={stats} />
            )}
            <TopStudents students={topStudents} isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </main>
    </div>
  );
}
