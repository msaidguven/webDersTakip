import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

type SlideRow = { slides: SlideDeck; generated_at: string };

// Öğrenciye gömülü slayt gösterisi — public ders sayfasıyla AYNI görünürlük kuralı:
// topics.is_active + topic_contents.is_published (bkz. lessonWeekData.ts), admin
// önizlemesi için ayrı /api/admin/topic-sections/slides GET var.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const supabase = createAnonClient();

  const { data: topic } = await supabase.from('topics').select('id').eq('id', topicId).eq('is_active', true).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: topicContent } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topicId)
    .eq('is_published', true)
    .maybeSingle();
  if (!topicContent) return NextResponse.json({ error: 'Bu konu için sunum henüz hazırlanmadı' }, { status: 404 });

  const { data: slideRow } = await supabase
    .from('topic_content_slides')
    .select('slides, generated_at')
    .eq('topic_content_id', (topicContent as { id: number }).id)
    .maybeSingle();
  if (!slideRow) return NextResponse.json({ error: 'Bu konu için sunum henüz hazırlanmadı' }, { status: 404 });

  const row = slideRow as SlideRow;
  return NextResponse.json({ deck: row.slides, generatedAt: row.generated_at });
}
