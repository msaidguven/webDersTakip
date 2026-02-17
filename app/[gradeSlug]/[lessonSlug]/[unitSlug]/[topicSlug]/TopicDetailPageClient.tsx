'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Props {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

export default function TopicDetailPageClient({ gradeSlug, lessonSlug, unitSlug, topicSlug }: Props) {
  
  const [topic, setTopic] = useState<any>(null);
  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    async function load() {
      const topicId = parseInt(topicSlug);

      const { data: tData } = await supabase
        .from('topics')
        .select('id, title')
        .eq('id', topicId)
        .single();

      if (!tData) {
        setLoading(false);
        return;
      }

      setTopic(tData);

      const { data: cData } = await supabase
        .from('topic_contents')
        .select('id, title, content, order_no')
        .eq('topic_id', tData.id)
        .order('order_no');

      setContents(cData || []);
      setLoading(false);
    }

    load();
  }, [topicSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!topic) return <div className="p-8">Konu bulunamadı</div>;

  return (
    <div className="p-8 max-w-4xl">
      <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`} className="text-blue-600">← Konular</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">{topic.title}</h1>

      <div className="space-y-6">
        {contents.map((content: any) => (
          <div key={content.id} className="border p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">{content.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </div>
        ))}
      </div>
    </div>
  );
}
