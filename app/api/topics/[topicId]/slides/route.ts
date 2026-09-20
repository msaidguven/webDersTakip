import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { generateSlideDeck } from '@/app/src/lib/topicSlideDeck';

// Öğrenciye gömülü slayt gösterisi — public ders sayfasıyla AYNI görünürlük kuralı:
// topics.is_active + topic_contents.is_published (bkz. lessonWeekData.ts), admin
// önizlemesi için ayrı /api/admin/topic-sections/slides GET var. Slaytlar artık ayrı bir AI
// çağrısı gerektirmediği (review_summary'den türetiliyor, bkz. topicSlideDeck.ts) için
// önceden üretilip topic_content_slides'a kaydedilmiş bir kaydı BEKLEMİYORUZ — her istekte
// canlı hesaplanıyor, admin "Sunum Oluştur"a hiç basmasa da içerik varsa sunum hemen izlenir.
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

  const result = await generateSlideDeck(supabase, topicId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ deck: result.deck });
}
