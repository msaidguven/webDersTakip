import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğretmen hesabını onayla (admin anasayfası → Acil uyarılar). Yalnız role='teacher' ve henüz onaysız
// hesap güncellenir; öğretmene site bildirimi gider (bildirim panelden "Yazılı hazırla"ya götürür —
// o sayfa onayı sunucuda canlı okur, anasayfadaki 30 dk'lık profil önbelleğine takılmaz).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', id)
    .eq('role', 'teacher')
    .eq('is_verified', false)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'Onay bekleyen öğretmen bulunamadı' }, { status: 404 });

  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: id,
    type: 'teacher_approved',
    title: 'Öğretmen hesabın onaylandı',
    body: 'Artık soru havuzundan yazılı kağıdı hazırlayıp PDF ya da Word olarak indirebilirsin.',
    link: '/ogretmen/yazili',
  });
  // Onay asıl iş; bildirim gitmezse onay geri alınmaz, yalnız loglanır.
  if (notifyError) console.error('[teachers/approve] bildirim eklenemedi:', notifyError.message);

  return NextResponse.json({ ok: true });
}
