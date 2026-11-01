import { after, NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Slayt / sesli anlatım kullanım olayı (bkz. supabase/migrations/content_usage_stats.sql). Misafir de sayılır
// (user_id boş). Yanıt hemen döner; kayıt yanıttan sonra yazılır ve başarısız olsa yalnız loglanır.
const KINDS = new Set(['slides_open', 'slides_finish', 'narration_play', 'narration_finish']);

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { kind?: unknown; topicId?: unknown } | null;
  const kind = typeof body?.kind === 'string' && KINDS.has(body.kind) ? body.kind : null;
  const topicId = Number(body?.topicId);
  if (!kind || !Number.isInteger(topicId) || topicId <= 0) return NextResponse.json({ error: 'Geçersiz olay' }, { status: 400 });

  const { data: { user } } = await (await createClient()).auth.getUser();
  after(async () => {
    const service = createServiceClient();
    let role = 'guest';
    if (user) {
      const { data } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle();
      role = data?.role === 'teacher' || data?.role === 'admin' ? data.role : 'student';
    }
    const { error } = await service.from('content_view_events').insert({ user_id: user?.id ?? null, role, kind, topic_id: topicId });
    if (error) console.error('[content_view_events] kaydedilemedi:', error.message);
  });
  return new NextResponse(null, { status: 204 });
}
