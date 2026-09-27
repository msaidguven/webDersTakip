import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DAYS = new Set([1, 7, 30, 90]);

// Admin "Üye Aktivitesi" paneli: özet + en çok ziyaret edilen sayfalar + üye listesi
// (admin_member_activity_summary) ve ziyaret akışı (admin_recent_page_views, ?user= ile
// tek üyeye daraltılır). Toplulaştırma DB'de — bkz. admin_member_activity_rpcs.sql.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 7;
  const userParam = request.nextUrl.searchParams.get('user');
  const userId = userParam && UUID_RE.test(userParam) ? userParam : null;

  const supabase = createServiceClient();
  const [summary, feed] = await Promise.all([
    supabase.rpc('admin_member_activity_summary', { p_days: days }),
    supabase.rpc('admin_recent_page_views', { p_user_id: userId, p_limit: userId ? 300 : 100 }),
  ]);

  const error = summary.error || feed.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ summary: summary.data, feed: feed.data ?? [] });
}
