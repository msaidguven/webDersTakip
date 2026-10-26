import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const ALLOWED_DAYS = new Set([30, 90]);

// Admin "Site Gelişimi" paneli: tüm toplulaştırma admin_growth_stats RPC'sinde (bkz.
// supabase/migrations/admin_growth_stats.sql), tek çağrı.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  const { data, error } = await createServiceClient().rpc('admin_growth_stats', { p_days: days });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
