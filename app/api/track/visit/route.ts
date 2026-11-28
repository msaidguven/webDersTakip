import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  isAppMode,
  isDeviceType,
  isLandingGroup,
  isLikelyBotUserAgent,
  isSourceGroup,
} from '@/app/src/lib/traffic';

// Saatlik ziyaretçi/üye trafik ping'i: istemci localStorage ile saatte en fazla 1 kez gönderir.
// visitor_type istemciden alınmaz — gerçek Supabase oturumundan sunucuda belirlenir.
// Admin ve test hesapları RPC içinde sessizce atlanır; bot User-Agent'lar burada elenir.
export async function POST(request: NextRequest) {
  const ua = request.headers.get('user-agent');
  if (isLikelyBotUserAgent(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const { device_type, app_mode, source_group, landing_group } = body;
  if (
    !isDeviceType(device_type) ||
    !isAppMode(app_mode) ||
    !isSourceGroup(source_group) ||
    !isLandingGroup(landing_group)
  ) {
    return NextResponse.json({ error: 'Geçersiz trafik parametreleri' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }

  const visitorType = userId ? 'member' : 'guest';

  try {
    const service = createServiceClient();
    const { error } = await service.rpc('record_traffic_ping', {
      p_visitor_type: visitorType,
      p_device_type: device_type,
      p_app_mode: app_mode,
      p_source_group: source_group,
      p_landing_group: landing_group,
      p_user_id: userId,
    });
    if (error && process.env.NODE_ENV !== 'production') {
      console.warn('record_traffic_ping:', error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('record_traffic_ping exception:', err);
    }
  }

  return new NextResponse(null, { status: 204 });
}
