import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DAYS = new Set([1, 7, 30, 90]);

// Admin "Üye Aktivitesi" paneli: özet + en çok ziyaret edilen sayfalar + son ziyaretler
// (admin_member_activity_summary, admin_recent_page_views). ?user= verilirse yalnızca o üyenin
// sayfa geçmişi döner (detay panelindeki "Sayfa geçmişi" için). Toplulaştırma DB'de.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const userParam = request.nextUrl.searchParams.get('user');

  if (userParam) {
    if (!UUID_RE.test(userParam)) return NextResponse.json({ error: 'Geçersiz üye' }, { status: 400 });
    const { data, error } = await supabase.rpc('admin_recent_page_views', { p_user_id: userParam, p_limit: 300 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feed: data ?? [] });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 7;

  const [summary, feed] = await Promise.all([
    supabase.rpc('admin_member_activity_summary', { p_days: days }),
    supabase.rpc('admin_recent_page_views', { p_user_id: null, p_limit: 100 }),
  ]);

  const error = summary.error || feed.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ summary: summary.data, feed: feed.data ?? [] });
}
