import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseQuestions, INVALID_MESSAGE } from '@/app/src/lib/parseMixedQuestions';
import { insertQuestions } from '@/app/src/lib/questionInsert';
import { revalidateUnitPagesForTopics, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';

interface Params {
  sectionId: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body, 20);

  if (!questions) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
  }

  const rawAiModel = (body as { ai_model?: unknown } | null)?.ai_model;
  const aiModel = typeof rawAiModel === 'string' && rawAiModel.trim() ? rawAiModel.trim() : null;

  const supabase = createServiceClient();

  // topic_id hiyerarşinin (ünite/ders/sınıf) tek kaynağı olacağı için client'tan değil,
  // section -> topic_content -> topic zincirinden sunucu tarafında çıkarıyoruz.
  const { data: sectionRow, error: sectionError } = await supabase
    .from('topic_content_sections')
    .select('id, topic_content_id')
    .eq('id', sectionId)
    .maybeSingle();

  if (sectionError || !sectionRow) {
    return NextResponse.json({ error: 'Alt başlık bulunamadı' }, { status: 404 });
  }

  const { data: topicContentRow, error: topicContentError } = await supabase
    .from('topic_contents')
    .select('id, topic_id')
    .eq('id', (sectionRow as { topic_content_id: number }).topic_content_id)
    .maybeSingle();

  if (topicContentError || !topicContentRow) {
    return NextResponse.json({ error: 'Konu içeriği bulunamadı' }, { status: 404 });
  }

  const topicId = (topicContentRow as { topic_id: number }).topic_id;

  const { data: linkRows, error: linkError } = await supabase
    .from('topic_content_section_outcomes')
    .select('outcome_id')
    .eq('section_id', sectionId);

  if (linkError) {
    return NextResponse.json({ error: 'Alt başlık kazanımları okunamadı' }, { status: 500 });
  }

  const outcomeIds = ((linkRows as { outcome_id: number }[] | null) || []).map((r) => r.outcome_id);
  if (!outcomeIds.length) {
    return NextResponse.json({ error: 'Bu alt başlığa bağlı kazanım yok — önce alt başlık planını oluşturun' }, { status: 409 });
  }

  const result = await insertQuestions(supabase, { topicId, sectionId: Number(sectionId), outcomeIds, questions, aiModel });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  const { savedCount, skippedDuplicateCount } = result;

  await revalidateUnitPagesForTopics(supabase, [topicId]);
  revalidateHomepage();
  return NextResponse.json({ ok: true, savedCount, skippedDuplicateCount });
}
