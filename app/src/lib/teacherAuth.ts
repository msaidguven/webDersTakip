import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

type ProfileRoleRow = { role: string | null; is_verified: boolean | null };

export type TeacherAccess =
  | { ok: true; user: User; role: 'admin' | 'teacher'; verified: boolean }
  | { ok: false; reason: 'login' | 'forbidden' };

// requireAdmin (adminAuth.ts) ile aynı desen. Admin da geçer — üstte zaten her şeye
// yetkili olan bir rolün, altındaki öğretmen paneline erişememesi anlamsız olurdu.
// 2026-10-28 (kullanıcı kararı): öğretmen araçları (yazılı hazırlama, Word/PDF) ONAYSIZ öğretmene de açık —
// kullandıkları içerik (sorular, cevap anahtarı) zaten herkese açık; onay beklerken öğretmen değer görmeden
// gidiyordu. is_verified (admin onayı, MembersTab.tsx) artık rozeti ve ileride öğrenci verisine erişimi açar;
// `verified` o kapılar için döner. role
// döndürülüyor ki çağıran route, "admin her şeyi görür ama öğretmen sadece kendi
// branşlarını görür" gibi bir ayrım yapabilsin (bkz. classical-questions/options).
// Sunucu sayfaları (ör. /ogretmen/yazili) getTeacherAccess'i, route'lar requireTeacher'ı kullanır.
export async function getTeacherAccess(): Promise<TeacherAccess> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'login' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified')
    .eq('id', user.id)
    .maybeSingle();

  const row = profile as ProfileRoleRow | null;
  if (row?.role === 'admin') return { ok: true, user, role: 'admin', verified: true };
  if (row?.role === 'teacher') return { ok: true, user, role: 'teacher', verified: !!row.is_verified };
  return { ok: false, reason: 'forbidden' };
}

export async function requireTeacher() {
  const access = await getTeacherAccess();
  if (!access.ok) {
    return access.reason === 'login'
      ? { ok: false as const, response: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) }
      : { ok: false as const, response: NextResponse.json({ error: 'Bu alan sadece öğretmenler içindir' }, { status: 403 }) };
  }
  return { ok: true as const, user: access.user, role: access.role };
}
