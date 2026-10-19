import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Üye Aktivitesi aylık ders takip çizelgesi: seçilen ayda gün × ders (admin_member_monthly_activity).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Geçersiz üye' }, { status: 400 });

  const month = request.nextUrl.searchParams.get('month') ?? '';
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Geçersiz ay' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('admin_member_monthly_activity', { p_user_id: id, p_month: `${month}-01` });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data ?? [] });
}
