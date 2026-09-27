import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getTopicPageDesign, isTopicPageDesign, TOPIC_PAGE_DESIGN_KEY, TOPIC_PAGE_ROUTE } from '@/app/src/lib/topicPageDesign';
import { describeTopic, TOPIC_LINK_SELECT, type EmbeddedTopic } from '@/app/src/lib/workerRunStats';

// Admin → Ayarlar sayfası: mevcut ayarlar + tasarımları önizlemek için yayında örnek bir konu.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const [topicPageDesign, { data: sample }] = await Promise.all([
    getTopicPageDesign(supabase),
    supabase.from('topic_contents').select(`topic_id, ${TOPIC_LINK_SELECT}`).eq('is_published', true).limit(1).maybeSingle(),
  ]);
  const samplePath = sample ? describeTopic((sample as unknown as { topics: EmbeddedTopic }).topics).href : null;

  return NextResponse.json({ settings: { [TOPIC_PAGE_DESIGN_KEY]: topicPageDesign }, samplePath });
}

// Site geneli ayar değişikliği (şimdilik yalnız konu sayfası tasarımı). Yeni değer yazılınca
// tüm konu sayfaları anında revalidate edilir — herkes bir sonraki açılışta yeni tasarımı görür.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { key?: unknown; value?: unknown } | null;
  if (body?.key !== TOPIC_PAGE_DESIGN_KEY || !isTopicPageDesign(body.value)) {
    return NextResponse.json({ error: 'Geçersiz ayar' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString(), updated_by: admin.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath(TOPIC_PAGE_ROUTE, 'page');
  return NextResponse.json({ ok: true, value: body.value });
}
