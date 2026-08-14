import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { syncMebSchools } from '@/app/src/lib/mebSchoolsSync';

export const maxDuration = 300;

// Mevcut durum: toplam okul sayısı ve son güncelleme zamanı (admin panelde gösterilir).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { count } = await supabase.from('schools').select('*', { count: 'exact', head: true });
  const { data: last } = await supabase
    .from('schools')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ count: count || 0, lastUpdatedAt: (last as { updated_at?: string } | null)?.updated_at || null });
}

// MEB okul dizinini yeniden çeker ve public.schools tablosuna upsert eder.
// İdempotenttir (meb_kurum_kodu üzerinden merge); admin panelindeki "Okulları Güncelle"
// butonu tarafından yılda birkaç kez tetiklenmesi beklenir.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  try {
    const result = await syncMebSchools(supabase, { write: true });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, { status: 500 });
  }
}
