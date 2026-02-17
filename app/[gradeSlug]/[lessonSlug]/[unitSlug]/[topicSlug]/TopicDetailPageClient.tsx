'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ChevronRight, Home, GraduationCap, BookOpen, FileText, CheckCircle } from 'lucide-react';

interface Content {
  id: number;
  title: string;
  content: string;
  order_no: number;
}

interface Outcome {
  id: number;
  description: string;
}

export default function TopicDetailPageClient() {
  const params = useParams();
  const gradeSlug = params.gradeSlug as string;
  const lessonSlug = params.lessonSlug as string;
  const unitSlug = params.unitSlug as string;
  const topicSlug = params.topicSlug as string;
  
  const [grade, setGrade] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [topic, setTopic] = useState<any>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
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

      const { data: topicData } = await supabase
        .from('topics')
        .select('*')
        .eq('slug', topicSlug)
        .eq('unit_id', unitData.id)
        .single();

      if (!topicData) {
        setLoading(false);
        return;
      }

      setTopic(topicData);

      const [{ data: contentsData }, { data: outcomesData }] = await Promise.all([
        supabase.from('topic_contents').select('*').eq('topic_id', topicData.id).order('order_no'),
        supabase.from('outcomes').select('*').eq('topic_id', topicData.id).order('order_index'),
      ]);

      setContents(contentsData || []);
      setOutcomes(outcomesData || []);
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug, unitSlug, topicSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!grade || !lesson || !unit || !topic) {
    return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{lesson.icon || '📘'}</span>
            <div>
              <h1 className="text-2xl font-bold">{topic.title}</h1>
              <p className="text-indigo-100">{grade.name} • {lesson.name} • {unit.title}</p>
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
            <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}>{unit.title}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default">{topic.title}</span>
          </nav>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {outcomes.length > 0 && (
          <div className="mb-8 bg-surface-elevated rounded-xl border border-default p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" /> Kazanımlar
            </h2>
            <ul className="space-y-3">
              {outcomes.map((outcome) => (
                <li key={outcome.id} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2"></span>
                  <span>{outcome.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {contents.map((content) => (
            <article key={content.id} className="bg-surface-elevated rounded-xl border border-default p-6">
              <h2 className="text-xl font-semibold mb-4">{content.title}</h2>
              <div 
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: content.content }}
              />
            </article>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-default flex gap-4">
          <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`} className="flex items-center gap-2 text-muted">
            <BookOpen className="w-4 h-4" /> Konular
          </Link>
          <Link href={`/${gradeSlug}/${lessonSlug}`} className="flex items-center gap-2 text-muted">
            <GraduationCap className="w-4 h-4" /> Üniteler
          </Link>
        </div>
      </main>
    </div>
  );
}
