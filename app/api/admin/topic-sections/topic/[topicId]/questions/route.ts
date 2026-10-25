import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseQuestions, INVALID_MESSAGE } from '@/app/src/lib/parseMixedQuestions';
import { insertQuestions } from '@/app/src/lib/questionInsert';
import { revalidateUnitPagesForTopics, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';

interface Params {
  topicId: string;
}

// Alt başlığa değil, doğrudan konunun geneline ait (section_id boş) sentez/genel tekrar
// soruları kaydeder — ünite testinde bu şekilde de gösterilir (bkz. add_question_scope_and_source.sql).
export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { topicId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body, 20);

  if (!questions) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
  }

  const rawAiModel = (body as { ai_model?: unknown } | null)?.ai_model;
  const aiModel = typeof rawAiModel === 'string' && rawAiModel.trim() ? rawAiModel.trim() : null;

  const supabase = createServiceClient();

  const { data: topicRow, error: topicError } = await supabase
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .maybeSingle();

  if (topicError || !topicRow) {
    return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  }

  const { data: outcomeRows, error: outcomeError } = await supabase
    .from('outcomes')
    .select('id')
    .eq('topic_id', topicId)
    .eq('is_current', true);

  if (outcomeError) {
    return NextResponse.json({ error: 'Konu kazanımları okunamadı' }, { status: 500 });
  }

  const outcomeIds = ((outcomeRows as { id: number }[] | null) || []).map((r) => r.id);
  if (!outcomeIds.length) {
    return NextResponse.json({ error: 'Bu konuya bağlı kazanım yok' }, { status: 409 });
  }

  const result = await insertQuestions(supabase, { topicId: (topicRow as { id: number }).id, sectionId: null, outcomeIds, questions, aiModel });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  const { savedCount, skippedDuplicateCount } = result;

  // Konu geneli sorular da ünite testi sayacını, konunun soru bankası sayfasını (ilk soruda
  // "henüz soru yok"tan normal, indekslenebilir sayfaya dönüşüyor) ve hub'ları etkiliyor.
  if (savedCount > 0) {
    await revalidateUnitPagesForTopics(supabase, [(topicRow as { id: number }).id]);
    revalidateHomepage();
  }

  return NextResponse.json({ ok: true, savedCount, skippedDuplicateCount });
}
