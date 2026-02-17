'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function TopicDetailPageClient({ gradeSlug, lessonSlug, unitSlug, topicSlug }: { gradeSlug: string; lessonSlug: string; unitSlug: string; topicSlug: string }) {
  const [data, setData] = useState<{ topic: any; contents: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Topic'i bul (slug veya id)
      let topicQuery = supabase.from('topics').select('*');
      if (!isNaN(Number(topicSlug))) {
        topicQuery = topicQuery.eq('id', topicSlug);
      } else {
        topicQuery = topicQuery.eq('slug', topicSlug);
      }
      
      const { data: topicData } = await topicQuery.single();
      
      if (!topicData) {
        setLoading(false);
        return;
      }

      // İçerikleri çek
      const { data: contentsData } = await supabase
        .from('topic_contents')
        .select('*')
        .eq('topic_id', topicData.id)
        .order('order_no');

      setData({
        topic: topicData,
        contents: contentsData || []
      });
      setLoading(false);
    }

    load();
  }, [topicSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!data) return <div className="p-8">Konu bulunamadı</div>;

  return (
    <div className="p-8 max-w-4xl">
      <Link href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`} className="text-blue-600">← Konular</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">{data.topic.title}</h1>

      <Link 
        href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}/test`}
        className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg mb-6 hover:bg-indigo-700"
      >
        📝 Konu Testi Çöz
      </Link>

      <div className="space-y-6">
        {data.contents.map((content: any) => (
          <div key={content.id} className="border p-6 rounded">
            <h2 className="text-xl font-semibold mb-4">{content.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </div>
        ))}
      </div>
    </div>
  );
}
