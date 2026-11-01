import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin anasayfası "Yazılı kullanımı" (2026-10-29): tüm toplulaştırma admin_yazili_usage RPC'sinde
// (bkz. supabase/migrations/admin_yazili_usage.sql), tek çağrı.
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await createServiceClient().rpc('admin_yazili_usage');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
