import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateSlideDeck } from '@/app/src/lib/topicSlideDeck';

// POST hâlâ topic_content_slides'a yazıyor — sadece pptx export (presentation/route.ts)
// için, o akış hâlâ kaydedilmiş bir satır bekliyor. Önizleme/görüntüleme (GET) artık buna
// bağımlı değil, her istekte canlı üretiyor (bkz. aşağıdaki GET) — "önce Sunum Oluştur'a
// bas, sonra izle" adımı sadece pptx indirmek isteyenler için gerekli, izlemek için değil.
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
      { topic_content_id: result.topicContentId, slides: result.deck, ai_model: null, generated_at: new Date().toISOString() },
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
  const result = await generateSlideDeck(supabase, topicId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ deck: result.deck });
}
