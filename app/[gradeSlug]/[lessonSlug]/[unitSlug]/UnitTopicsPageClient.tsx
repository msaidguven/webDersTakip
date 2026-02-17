'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { FileText, ChevronRight, Home, GraduationCap, BookOpen } from 'lucide-react';

interface Topic {
  id: number;
  title: string;
  slug: string;
  order_no: number;
  question_count: number;
}

export default function UnitTopicsPageClient() {
  const params = useParams();
  const gradeSlug = params.gradeSlug as string;
  const lessonSlug = params.lessonSlug as string;
  const unitSlug = params.unitSlug as string;
  
  const [grade, setGrade] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
        supabase.from('grades').select('*').eq('slug', gradeSlug).single(),
        supabase.from('lessons').select('*').eq('slug', lessonSlug).single(),
      ]);

      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      setGrade(gradeData);
      setLesson(lessonData);

      const { data: unitData } = await supabase
        .from('units')
        .select('*')
        .eq('slug', unitSlug)
        .eq('lesson_id', lessonData.id)
        .single();

      if (!unitData) {
        setLoading(false);
        return;
      }

      setUnit(unitData);

      const { data: topicsData } = await supabase
        .from('topics')
        .select('*')
        .eq('unit_id', unitData.id)
        .eq('is_active', true)
        .eq('order_status', 'approved')
        .order('order_no');

      setTopics(topicsData || []);
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug, unitSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!grade || !lesson || !unit) {
    return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{lesson.icon || '📘'}</span>
            <div>
              <h1 className="text-2xl font-bold">{unit.title}</h1>
              <p className="text-indigo-100">{grade.name} • {lesson.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted flex-wrap">
            <Link href="/" className="flex items-center gap-1"><Home className="w-4 h-4" /> Anasayfa</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}`}>{grade.name}</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}/${lessonSlug}`}>{lesson.name}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default">{unit.title}</span>
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Konular
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map((topic, index) => (
            <Link
              key={topic.id}
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
              className="block bg-surface-elevated border border-default rounded-xl p-5 hover:border-indigo-300 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{topic.title}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-muted mt-1" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <Link href={`/${gradeSlug}/${lessonSlug}`} className="flex items-center gap-2 text-muted">
            <BookOpen className="w-4 h-4" /> Üniteler
          </Link>
          <Link href={`/${gradeSlug}`} className="flex items-center gap-2 text-muted">
            <GraduationCap className="w-4 h-4" /> Dersler
          </Link>
        </div>
      </main>
    </div>
  );
}
