'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export interface SidebarLesson {
  id: string;
  name: string;
}

export interface GradeOption {
  id: number;
  name: string;
}

export type SidebarLessonsStatus = 'idle' | 'loading' | 'need-grade' | 'ready';

type LessonGradeRow = {
  lesson_id: number;
  lessons:
    | { id: number; name: string; is_active: boolean }
    | { id: number; name: string; is_active: boolean }[]
    | null;
};

// Sidebar'daki statik Ana Sayfa/Üniteler/Profil/Siteye Dön linkleri kaldırılıp
// yerine kullanıcının profilindeki sınıfa (grade_id) göre o sınıfın aktif dersleri
// eklendi. Sınıf seçilmemişse burada seçtirip /api/profile/update (ProfilClient'ın
// kullandığı aynı endpoint) ile kaydediyoruz. Buradaki dersler ayrı bir sayfaya
// gitmiyor — tıklanınca panel anasayfasının kendi ders geçiş mekanizması
// (useDashboardViewModel.selectLesson) tetikleniyor, bkz. Sidebar.tsx.
export function useSidebarLessons() {
  const { user, supabase } = useAuth();
  const [status, setStatus] = useState<SidebarLessonsStatus>('idle');
  const [lessons, setLessons] = useState<SidebarLesson[]>([]);
  const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const loadLessonsForGrade = useCallback(
    async (gradeId: number): Promise<SidebarLesson[]> => {
      const { data: lessonGradeRows } = await supabase
        .from('lesson_grades')
        .select('lesson_id, lessons(id, name, is_active)')
        .eq('grade_id', gradeId)
        .eq('is_active', true);

      const rows = (lessonGradeRows as LessonGradeRow[] | null) || [];
      const result: SidebarLesson[] = [];
      for (const row of rows) {
        const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
        if (!lesson || lesson.is_active === false) continue;
        result.push({ id: String(lesson.id), name: lesson.name });
      }
      result.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      return result;
    },
    [supabase]
  );

  useEffect(() => {
    if (!user) {
      setStatus('idle');
      setLessons([]);
      setGradeOptions([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetch('/api/profile/update')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data: { profile: { grade_id: number | null } | null } | null) => {
        if (cancelled) return;
        const gradeId = data?.profile?.grade_id ?? null;

        if (!gradeId) {
          const { data: grades } = await supabase.from('grades').select('id, name').order('order_no');
          if (cancelled) return;
          setGradeOptions((grades as GradeOption[] | null) || []);
          setStatus('need-grade');
          return;
        }

        const gradeLessons = await loadLessonsForGrade(gradeId);
        if (cancelled) return;
        setLessons(gradeLessons);
        setStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [user, supabase, loadLessonsForGrade]);

  const saveGrade = useCallback(async () => {
    if (!selectedGradeId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch: { grade_id: selectedGradeId } }),
      });
      if (!res.ok) return;
      const gradeLessons = await loadLessonsForGrade(selectedGradeId);
      setLessons(gradeLessons);
      setStatus('ready');
    } finally {
      setSaving(false);
    }
  }, [selectedGradeId, loadLessonsForGrade]);

  return { status, lessons, gradeOptions, selectedGradeId, setSelectedGradeId, saving, saveGrade };
}
