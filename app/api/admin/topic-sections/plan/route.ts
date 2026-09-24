import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { publishTopicContent, type IncomingSection, type IncomingCover } from '@/app/src/lib/publishTopicContent';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as {
    topicId?: number | string;
    sections?: IncomingSection[];
    cover?: IncomingCover;
    ai_model?: unknown;
    summary_markdown?: unknown;
    discussion_prompt_markdown?: unknown;
  } | null;

  if (!body?.topicId || !Array.isArray(body.sections) || body.sections.length === 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const result = await publishTopicContent(supabase, {
    topicId: body.topicId,
    sections: body.sections,
    cover: body.cover,
    ai_model: body.ai_model,
    summary_markdown: body.summary_markdown,
    discussion_prompt_markdown: body.discussion_prompt_markdown,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, topicContentId: result.topicContentId, unresolvedCodes: result.unresolvedCodes });
}
