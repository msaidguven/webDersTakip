import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const POSITIONS = ['top-left', 'mid-left', 'bottom-left', 'top-right', 'mid-right', 'bottom-right'] as const;
type Position = (typeof POSITIONS)[number];

type IncomingHighlight = {
  position?: unknown;
  icon?: unknown;
  title?: unknown;
  description?: unknown;
  order_no?: unknown;
};

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

  const clean = (Array.isArray(body?.highlights) ? body.highlights : [])
    .filter((h): h is IncomingHighlight & { position: Position; title: string; description: string } =>
      typeof h.position === 'string' &&
      (POSITIONS as readonly string[]).includes(h.position) &&
      typeof h.title === 'string' && h.title.trim().length > 0 &&
      typeof h.description === 'string' && h.description.trim().length > 0
    )
    .map((h, idx) => ({
      topic_content_id: topicContentId,
      position: h.position,
      icon: typeof h.icon === 'string' && h.icon.trim() ? h.icon.trim() : null,
      title: h.title.trim(),
      description: h.description.trim(),
      order_no: typeof h.order_no === 'number' ? h.order_no : idx,
    }));

  const positionsUsed = new Set(clean.map((h) => h.position));
  if (positionsUsed.size !== clean.length) {
    return NextResponse.json({ error: 'Her pozisyon en fazla bir kez kullanılabilir' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: deleteError } = await supabase
    .from('topic_content_highlights')
    .delete()
    .eq('topic_content_id', topicContentId);

  if (deleteError) {
    return NextResponse.json({ error: 'Güncellenemedi' }, { status: 500 });
  }

  if (clean.length) {
    const { error: insertError } = await supabase.from('topic_content_highlights').insert(clean);
    if (insertError) {
      return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: clean.length });
}
