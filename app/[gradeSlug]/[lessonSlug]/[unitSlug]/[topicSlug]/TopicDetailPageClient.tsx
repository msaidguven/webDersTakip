'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Content {
  id: number;
  title: string;
  content: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: gradeData } = await supabase
        .from('grades')
        .select('id, name, slug')
        .or(`slug.eq.${gradeSlug},id.eq.${gradeSlug.replace('-sinif', '')}`)
        .single();

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, name, slug')
        .or(`slug.eq.${lessonSlug},id.eq.${lessonSlug}`)
        .single();

      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      setGrade({ ...gradeData, slug: gradeData.slug || `${gradeData.id}-sinif` });
      setLesson({ ...lessonData, slug: lessonData.slug || lessonData.id.toString() });

      const { data: unitData } = await supabase
        .from('units')
        .select('id, title, slug')
        .or(`slug.eq.${unitSlug},id.eq.${unitSlug}`)
        .eq('lesson_id', lessonData.id)
        .single();

      if (!unitData) {
        setLoading(false);
        return;
      }

      setUnit({ ...unitData, slug: unitData.slug || unitData.id.toString() });

      const { data: topicData } = await supabase
        .from('topics')
        .select('id, title, slug')
        .or(`slug.eq.${topicSlug},id.eq.${topicSlug}`)
        .eq('unit_id', unitData.id)
        .single();

      if (!topicData) {
        setLoading(false);
        return;
      }

      setTopic({ ...topicData, slug: topicData.slug || topicData.id.toString() });

      const { data: contentsData } = await supabase
        .from('topic_contents')
        .select('*')
        .eq('topic_id', topicData.id)
        .order('order_no');

      setContents(contentsData || []);
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug, unitSlug, topicSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  if (!grade || !lesson || !unit || !topic) return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">{topic.title}</h1>
          <p>{grade.name} • {lesson.name} • {unit.title}</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
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

        <div className="mt-8 flex gap-4">
          <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`} className="text-indigo-600">← Konular</Link>
          <Link href={`/${gradeSlug}/${lessonSlug}`} className="text-indigo-600">← Üniteler</Link>
        </div>
      </main>
    </div>
  );
}
