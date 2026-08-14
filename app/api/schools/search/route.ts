import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Herkese açık, salt-okunur okul dizini araması (profil formundaki okul seçici için).
// Kimlik doğrulama gerektirmez; schools tablosu zaten herkese açık SELECT politikasına sahip.
export async function GET(request: NextRequest) {
  const cityId = request.nextUrl.searchParams.get('cityId');
  const districtId = request.nextUrl.searchParams.get('districtId');
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 20;

  if (!cityId && (!q || q.length < 2)) {
    return NextResponse.json({ items: [] });
  }

  const supabase = createServiceClient();
  let query = supabase
    .from('schools')
    .select('id, name, school_type, city_id, district_id')
    .order('name')
    .limit(limit);

  if (cityId) query = query.eq('city_id', cityId);
  if (districtId) query = query.eq('district_id', districtId);
  if (q && q.length >= 2) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
