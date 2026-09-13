import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Verilen ünite id'lerinden hangilerinin "RAG Ünite Sentezi (Tekrar Kontrolü)" ile en az
// bir kez düzenlendiğini döner — ünite başlığının yanında yeşil tik göstermek için (bkz.
// topics-with-synthesis/route.ts, aynı desen).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('unitIds') || '';
  const unitIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!unitIds.length) return NextResponse.json({ unitIds: [] });

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('units').select('id').in('id', unitIds).not('rag_dedup_checked_at', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as { id: number }[] | null) || [];
  return NextResponse.json({ unitIds: rows.map((r) => r.id) });
}
