'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { useAuth } from './src/context/AuthContext';
import { Grade } from './src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from './src/lib/homeMapping';
import type { HomeGradeSection, SiteStats, WeeklyTopicItem } from './src/lib/homeStats';
import { HomeHero } from './src/components/home/HomeHero';
import { StatsBar } from './src/components/home/StatsBar';
import { GradeTabs } from './src/components/home/GradeTabs';
import { LessonGrid } from './src/components/home/LessonGrid';
import { QuickAccess } from './src/components/home/QuickAccess';
import { WeeklyTopics } from './src/components/home/WeeklyTopics';
import { WhyJoin, HowItWorks } from './src/components/home/WhyJoinAndHowItWorks';
import { FooterCTA } from './src/components/home/FooterCTA';

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
  weeklyTopics: Record<string, WeeklyTopicItem[]>;
}

export default function HomeClient({ initialGrades, stats, gradeSections, weeklyTopics }: HomeClientProps) {
  const { isAuthenticated } = useAuth();
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-radial" />

      <main className="relative py-8 sm:py-14 px-4 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
          <div className="space-y-8 sm:space-y-10">
            <HomeHero isAuthenticated={isAuthenticated} />
            <div className="rounded-2xl border border-default bg-surface-elevated p-3 shadow-sm sm:p-4">
              <StatsBar stats={stats} />
            </div>
          </div>

          {resolvedGrades.length > 0 && selectedGrade && (
            <div id="derslerimi" className="space-y-8 sm:space-y-10">
              <GradeTabs grades={resolvedGrades} selectedGradeId={selectedGrade.id} onSelect={setSelectedGradeId} />
              <div id="derslerimiz">
                <LessonGrid grade={selectedGrade} section={gradeSections[selectedGrade.id]} />
              </div>
            </div>
          )}

          <QuickAccess />

          {selectedGrade && (
            <div className={`grid grid-cols-1 gap-5 ${isAuthenticated ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              <WeeklyTopics topics={weeklyTopics[selectedGrade.id] ?? []} />
              {!isAuthenticated && <WhyJoin />}
              <HowItWorks />
            </div>
          )}

          <FooterCTA isAuthenticated={isAuthenticated} />
        </div>
      </main>
    </div>
  );
}
