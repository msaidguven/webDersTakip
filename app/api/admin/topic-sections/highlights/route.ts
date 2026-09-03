import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { cleanHighlights, replaceHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';
import { revalidateTopicPagesByContentIds } from '@/app/src/lib/topicPageRevalidation';

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as {
    topicContentId?: number | string;
    highlights?: IncomingHighlight[];
  } | null;

  const topicContentId = body?.topicContentId;
  if (!topicContentId) {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }

  const clean = cleanHighlights(topicContentId, body?.highlights);

  const supabase = createServiceClient();
  const error = await replaceHighlights(supabase, topicContentId, clean);
  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  await revalidateTopicPagesByContentIds(supabase, [topicContentId]);
  return NextResponse.json({ ok: true, count: clean.length });
}
