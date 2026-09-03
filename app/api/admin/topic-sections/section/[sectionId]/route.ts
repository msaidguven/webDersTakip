import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteSectionsCascade } from '@/app/src/lib/adminCascade';
import { revalidateTopicPagesBySectionIds } from '@/app/src/lib/topicPageRevalidation';

interface Params {
  sectionId: string;
}

// Ders sayfasındaki "İçeriği Düzenle" butonu (admin) için: düzenleme formunu doldurmak
// üzere tek bir alt başlığın ham markdown'ını ve görsel bilgisini döner.
export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('topic_content_sections')
    .select('id, heading, body_markdown, image_url, image_prompt, diagram_svg, source, ai_model')
    .eq('id', sectionId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Alt başlık bulunamadı' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null) as {
    body_markdown?: unknown;
    source?: unknown;
    ai_model?: unknown;
  } | null;

  if (!body || typeof body.body_markdown !== 'string' || !body.body_markdown.trim()) {
    return NextResponse.json({ error: 'Geçersiz içerik' }, { status: 400 });
  }

  if (body.source !== undefined && body.source !== 'manual' && body.source !== 'ai_generated') {
    return NextResponse.json({ error: 'Geçersiz source' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('topic_content_sections')
    .update({
      body_markdown: body.body_markdown.trim(),
      status: 'content_ready',
      updated_at: new Date().toISOString(),
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.ai_model !== undefined
        ? { ai_model: typeof body.ai_model === 'string' && body.ai_model.trim() ? body.ai_model.trim() : null }
        : {}),
    })
    .eq('id', sectionId);

  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  await revalidateTopicPagesBySectionIds(supabase, [sectionId]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const supabase = createServiceClient();

  // Silinmeden ÖNCE topic'i çözüp cache'i düşürüyoruz — satır gittikten sonra
  // section->topic zinciri kurulamaz (delete başarısız olsa bile zararsız: sayfa
  // olduğu gibi yeniden render edilir).
  await revalidateTopicPagesBySectionIds(supabase, [sectionId]);

  const { failed } = await deleteSectionsCascade(supabase, [Number(sectionId)]);
  if (failed.length) {
    return NextResponse.json({ error: failed[0].reason }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
