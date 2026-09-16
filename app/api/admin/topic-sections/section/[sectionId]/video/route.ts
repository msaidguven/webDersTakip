import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateTopicPagesBySectionIds } from '@/app/src/lib/topicPageRevalidation';

interface Params {
  sectionId: string;
}

// Görsel akışının aksine (bkz. section/[sectionId]/image/route.ts) burada dosya YÜKLEMİYORUZ —
// Vercel Functions'ın ~4.5MB istek gövdesi limiti kısa bir video dosyası için bile yetersiz.
// Bunun yerine admin, videoyu (AI üretimi ya da onayladığı bir YouTube önerisi) harici bir
// yerde barındırıp/üretip sadece URL'sini yapıştırıyor (kullanıcının 2026-09-16 isteği).
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null) as {
    video_prompt?: unknown;
    video_url?: unknown;
    video_type?: unknown;
  } | null;

  if (!body) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const update: Record<string, unknown> = {};

  // "Video Ekle" modalındaki prompt yeniden üretme adımı — sadece video_prompt güncellenir,
  // video_url'e hiç dokunulmaz (image_prompt PATCH'iyle aynı mantık).
  if (typeof body.video_prompt === 'string') {
    if (!body.video_prompt.trim()) {
      return NextResponse.json({ error: 'Geçersiz video promptu' }, { status: 400 });
    }
    update.video_prompt = body.video_prompt.trim();
  }

  // Nihai video bağlama — hem "Video Ekle" modalının kendi URL yapıştırma adımı (video_type:
  // 'ai_generated') hem de YouTube önerileri modalındaki "Onayla" butonu (video_type: 'youtube')
  // buraya yazıyor.
  if (typeof body.video_url === 'string') {
    if (!body.video_url.trim() || (body.video_type !== 'ai_generated' && body.video_type !== 'youtube')) {
      return NextResponse.json({ error: 'Geçersiz video URL/tipi' }, { status: 400 });
    }
    update.video_url = body.video_url.trim();
    update.video_type = body.video_type;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase.from('topic_content_sections').update(update).eq('id', sectionId);

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

  // Video promptuna dokunulmuyor — sadece bağlı video kaldırılıyor (image DELETE'iyle aynı desen).
  const { error } = await supabase
    .from('topic_content_sections')
    .update({ video_url: null, video_type: null, updated_at: new Date().toISOString() })
    .eq('id', sectionId);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  await revalidateTopicPagesBySectionIds(supabase, [sectionId]);
  return NextResponse.json({ ok: true });
}
