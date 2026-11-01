import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin anasayfası "Slayt ve sesli anlatım kullanımı" (2026-11-01): toplulaştırma admin_content_usage_stats
// RPC'sinde (bkz. supabase/migrations/content_usage_stats.sql), tek çağrı.
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await createServiceClient().rpc('admin_content_usage_stats');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
