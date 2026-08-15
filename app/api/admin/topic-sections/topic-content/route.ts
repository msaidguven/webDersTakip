import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as {
    topicContentId?: number | string;
    subtitle?: string;
    heroImagePrompt?: string;
    heroImageAlt?: string;
  } | null;
  const topicContentId = body?.topicContentId;
  if (!topicContentId) {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Sadece body'de gönderilen alanları güncelliyoruz; aksi halde örn. sadece
  // heroImagePrompt gönderilen bir istek, subtitle'ı yanlışlıkla null'a çekerdi.
  const update: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body || {}, 'subtitle')) {
    update.subtitle = typeof body?.subtitle === 'string' ? body.subtitle.trim() || null : null;
  }

  const hasHeroPrompt = Object.prototype.hasOwnProperty.call(body || {}, 'heroImagePrompt');
  const hasHeroAlt = Object.prototype.hasOwnProperty.call(body || {}, 'heroImageAlt');
  if (hasHeroPrompt || hasHeroAlt) {
    const { data: current } = await supabase
      .from('topic_contents')
      .select('generation_meta')
      .eq('id', topicContentId)
      .maybeSingle();
    const currentMeta = current?.generation_meta && typeof current.generation_meta === 'object'
      ? (current.generation_meta as Record<string, unknown>)
      : {};
    const nextMeta = { ...currentMeta };
    if (hasHeroPrompt) {
      const trimmed = typeof body?.heroImagePrompt === 'string' ? body.heroImagePrompt.trim() : '';
      nextMeta.heroImagePrompt = trimmed || null;
    }
    if (hasHeroAlt) {
      const trimmed = typeof body?.heroImageAlt === 'string' ? body.heroImageAlt.trim() : '';
      nextMeta.heroImageAlt = trimmed || null;
    }
    update.generation_meta = nextMeta;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const { error } = await supabase.from('topic_contents').update(update).eq('id', topicContentId);

  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
