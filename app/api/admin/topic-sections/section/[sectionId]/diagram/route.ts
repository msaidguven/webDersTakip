import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateTopicPagesBySectionIds } from '@/app/src/lib/topicPageRevalidation';

const MAX_SVG_LENGTH = 20_000;

interface Params {
  sectionId: string;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null) as { diagram_svg?: unknown } | null;

  const svg = typeof body?.diagram_svg === 'string' ? body.diagram_svg.trim() : '';
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
    return NextResponse.json({ error: 'Geçersiz SVG kodu' }, { status: 400 });
  }
  if (svg.length > MAX_SVG_LENGTH) {
    return NextResponse.json({ error: 'SVG kodu çok büyük' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('topic_content_sections')
    .update({ diagram_svg: svg, updated_at: new Date().toISOString() })
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

  const { error } = await supabase
    .from('topic_content_sections')
    .update({ diagram_svg: null, updated_at: new Date().toISOString() })
    .eq('id', sectionId);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  await revalidateTopicPagesBySectionIds(supabase, [sectionId]);
  return NextResponse.json({ ok: true });
}
