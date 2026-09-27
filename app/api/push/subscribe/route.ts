// Tarayıcı bildirimi aboneliği kaydet (POST) / sil (DELETE) — yol haritası 3c, 2026-09-27.
// Oturum sunucuda doğrulanır; yazma service role ile yapılır ki aynı cihazda hesap değişince
// endpoint yeni kullanıcıya taşınabilsin (RLS'li tabloda başka kullanıcının satırı güncellenemez).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type IncomingSubscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1000) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;

async function requireUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { subscription?: IncomingSubscription } | null;
  const sub = body?.subscription;
  if (!sub || !isValidEndpoint(sub.endpoint) || !isKey(sub.keys?.p256dh) || !isKey(sub.keys?.auth)) {
    return NextResponse.json({ error: 'Geçersiz abonelik' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys!.p256dh,
      auth: sub.keys!.auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
    },
    { onConflict: 'endpoint' }
  );
  if (error) return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: 'Giriş gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isValidEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const service = createServiceClient();
  await service.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', userId);
  return NextResponse.json({ ok: true });
}
