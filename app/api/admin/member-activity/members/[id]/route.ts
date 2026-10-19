import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_DAYS = new Set([1, 7, 30, 90]);

// Üye Aktivitesi detay paneli: profil doluluğu, dönem özeti, ders bazında tablo (admin_member_detail)
// ve kayıt kaynağı (signup_method, acquisition).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Geçersiz üye' }, { status: 400 });

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 7;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('admin_member_detail', { p_user_id: id, p_days: days });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Üye bulunamadı' }, { status: 404 });

  // Kayıt kaynağı (bkz. lib/acquisition.ts) RPC'de değil; profil satırından ayrıca okunur.
  const { data: origin } = await supabase.from('profiles').select('signup_method, acquisition').eq('id', id).maybeSingle();
  return NextResponse.json({ detail: { ...data, signup_method: origin?.signup_method ?? null, acquisition: origin?.acquisition ?? null } });
}
