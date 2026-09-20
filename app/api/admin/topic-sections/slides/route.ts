import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateSlideDeck, SLIDE_DECK_AI_MODEL, type SlideDeck } from '@/app/src/lib/topicSlideDeck';

type SlideRow = { slides: SlideDeck; generated_at: string };

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const result = await generateSlideDeck(supabase, topicId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const { error } = await supabase
    .from('topic_content_slides')
    .upsert(
      { topic_content_id: result.topicContentId, slides: result.deck, ai_model: SLIDE_DECK_AI_MODEL, generated_at: new Date().toISOString() },
      { onConflict: 'topic_content_id' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deck: result.deck });
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
  if (!topicContent) return NextResponse.json({ error: 'Bu konu için içerik hazırlanmamış' }, { status: 404 });

  const { data: slideRow } = await supabase
    .from('topic_content_slides')
    .select('slides, generated_at')
    .eq('topic_content_id', (topicContent as { id: number }).id)
    .maybeSingle();
  if (!slideRow) return NextResponse.json({ error: 'Bu konu için sunum henüz oluşturulmamış' }, { status: 404 });

  const row = slideRow as SlideRow;
  return NextResponse.json({ deck: row.slides, generatedAt: row.generated_at });
}
