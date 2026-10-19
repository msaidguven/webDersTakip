import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Üye Aktivitesi sol kenar çubuğu: admin olmayan tüm üyeler (admin_member_directory).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const search = (request.nextUrl.searchParams.get('search') ?? '').trim().slice(0, 100);

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('admin_member_directory', { p_search: search, p_limit: 500 });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
