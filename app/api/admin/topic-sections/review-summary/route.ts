import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateSlideDeck } from '@/app/src/lib/topicSlideDeck';

type IncomingSection = { heading?: unknown; review_summary?: unknown };

// Eski konularda eksik olan review_summary'yi (bkz. 32-topic-review-summary-backfill.md)
// mevcut alt başlıklara DOKUNMADAN, sadece bu tek kolonu güncelleyerek tamamlar — /plan
// route'unun aksine body_markdown/activity_* gibi alanları asla değiştirmez, o yüzden
// ayrı ve dar kapsamlı bir endpoint (kullanıcının 2026-09-20 isteği).
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { topicId?: number | string; sections?: IncomingSection[] } | null;
  const topicId = body?.topicId;
  const incoming = body?.sections;
  if (!topicId || !Array.isArray(incoming) || !incoming.length) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const clean = incoming
    .map((s) => ({
      heading: typeof s.heading === 'string' ? s.heading.trim() : '',
      review_summary: typeof s.review_summary === 'string' ? s.review_summary.trim() : '',
    }))
    .filter((s) => s.heading && s.review_summary);
  if (!clean.length) {
    return NextResponse.json({ error: 'JSON içinde geçerli heading/review_summary çifti bulunamadı' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
  const topicContentId = (topicContent as { id: number } | null)?.id;
  if (!topicContentId) return NextResponse.json({ error: 'Bu konu için içerik bulunamadı' }, { status: 404 });

  const { data: existingSections } = await supabase
    .from('topic_content_sections')
    .select('id, heading')
    .eq('topic_content_id', topicContentId);
  const idByHeading = new Map(((existingSections as { id: number; heading: string }[] | null) || []).map((s) => [s.heading, s.id]));

  const unmatchedHeadings: string[] = [];
  const updates = clean
    .map((s) => {
      const id = idByHeading.get(s.heading);
      if (!id) unmatchedHeadings.push(s.heading);
      return id ? { id, review_summary: s.review_summary } : null;
    })
    .filter((u): u is { id: number; review_summary: string } => u !== null);

  if (!updates.length) {
    return NextResponse.json({ error: 'Yapıştırılan başlıklardan hiçbiri bu konudaki alt başlıklarla eşleşmedi' }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map((u) => supabase.from('topic_content_sections').update({ review_summary: u.review_summary }).eq('id', u.id))
  );
  const updateError = results.map((r) => r.error).find((e): e is NonNullable<typeof e> => Boolean(e));
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Slaytlar review_summary'den türetildiği için değişikliği hemen yansıt (bkz. /plan
  // route'undaki aynı best-effort desen).
  try {
    const slideResult = await generateSlideDeck(supabase, Number(topicId));
    if (slideResult.ok) {
      await supabase
        .from('topic_content_slides')
        .upsert(
          { topic_content_id: slideResult.topicContentId, slides: slideResult.deck, ai_model: null, generated_at: new Date().toISOString() },
          { onConflict: 'topic_content_id' }
        );
    }
  } catch {
    // slayt önizlemesi opsiyonel bir yan etki, asıl kaydı engellemesin
  }

  return NextResponse.json({ ok: true, updatedCount: updates.length, unmatchedHeadings });
}
