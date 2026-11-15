import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin anasayfası "Etkileşimli dersler" (2026-11-03): üretim durumu + kullanım; toplulaştırma
// admin_interactive_lesson_stats RPC'sinde (bkz. supabase/migrations/interactive_lesson_progress_and_stats.sql).
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { data, error } = await createServiceClient().rpc('admin_interactive_lesson_stats');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
}
