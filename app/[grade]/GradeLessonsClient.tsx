'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Grade, Lesson } from '@/app/src/models/homeTypes';
import { LessonSelector } from '@/app/src/components/home/LessonSelector';

const CURRENT_WEEK = 19;

interface WeekContentRow {
  topic_content_id: number;
  topic_contents: {
    id: number;
    order_no: number | null;
    topic_id: number;
    topics: {
      id: number;
      slug: string | null;
      unit_id: number;
      units: {
        id: number;
        slug: string | null;
        lesson_id: number;
        unit_grades: { grade_id: number }[] | null;
      } | null;
    } | null;
  } | null;
}

interface GradeLessonsClientProps {
  grade: Grade;
  lessons: Lesson[];
}

export default function GradeLessonsClient({ grade, lessons }: GradeLessonsClientProps) {
  const [selectedWeek, setSelectedWeek] = useState<number>(CURRENT_WEEK);

  const getWeeklyRouteForLesson = async (
    gradeId: string,
    lesson: Lesson,
    week: number
  ): Promise<string | null> => {
    const supabase = createClient();
    const gId = parseInt(gradeId, 10);
    if (!Number.isFinite(gId) || gId <= 0 || !lesson.slug) {
      return null;
    }

    const { data, error } = await supabase
      .from('topic_content_weeks')
      .select('topic_content_id, topic_contents!inner(id, order_no, topic_id, topics!inner(id, slug, unit_id, units!inner(id, slug, lesson_id, unit_grades!inner(grade_id))))')
      .eq('curriculum_week', week);

    if (error) {
      console.error('[GradeLessonsClient getWeeklyRouteForLesson] HATA:', error);
      return null;
    }

    const rows = (data as unknown as WeekContentRow[] | null) || [];
    const filtered = rows
      .map((row) => row.topic_contents)
      .filter((content) => {
        const unit = content?.topics?.units;
        if (!unit || unit.lesson_id !== parseInt(lesson.id, 10)) return false;
        const grades = unit.unit_grades || [];
        return grades.some((ug) => ug.grade_id === gId);
      })
      .sort((a, b) => (a?.order_no ?? 0) - (b?.order_no ?? 0));

    const first = filtered[0];
    const unitSlug = first?.topics?.units?.slug || null;
    const topicSlug = first?.topics?.slug || null;

    if (!unitSlug || !topicSlug) {
      return null;
    }

    const gradeSegment = `${gId}-sınıf`;
    const weekSegment = `hafta-${week}`;
    return `/${gradeSegment}/${lesson.slug}/${unitSlug}/${weekSegment}/${topicSlug}`;
  };

  return (
    <div className="min-h-screen">
      <main className="py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-default">Mufredat Haftasi</h2>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[17, 18, 19, 20, 21, 22].map((week) => (
                <button
                  key={week}
                  disabled={week > 21}
                  onClick={() => {
                    if (week <= 21) setSelectedWeek(week);
                  }}
                  className={`
                    flex flex-col items-center min-w-[72px] py-3 px-4 rounded-xl transition-all
                    ${week === selectedWeek 
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' 
                      : week > 21
                        ? 'bg-surface-elevated text-muted cursor-not-allowed'
                        : 'bg-surface-elevated text-muted hover:bg-surface hover:text-default border border-default'
                    }
                  `}
                >
                  <span className="text-2xl font-bold">{week}</span>
                  <span className="text-xs mt-1">
                    {week === selectedWeek ? 'Secili' : week < CURRENT_WEEK ? 'Gecen' : week > 21 ? 'Kilitli' : 'Gelecek'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <LessonSelector
            grade={grade}
            lessons={lessons}
            isLoading={false}
            onSelect={async (lesson: Lesson) => {
              // Yeni URL formatı: isim/slug bazlı
              const url = lesson.slug 
                ? `/ders?sinif=${grade.id}&ders=${lesson.slug}`
                : `/ders?sinif=${grade.id}&ders_id=${lesson.id}`;
              window.location.href = url;
            }}
            onBack={() => {
              window.location.href = '/';
            }}
          />
        </div>
      </main>
    </div>
  );
}
