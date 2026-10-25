import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

type ProfileRoleRow = { role: string | null; is_verified: boolean | null };

export type TeacherAccess =
  | { ok: true; user: User; role: 'admin' | 'teacher' }
  | { ok: false; reason: 'login' | 'pending' | 'forbidden' };

// requireAdmin (adminAuth.ts) ile aynı desen. Admin da geçer — üstte zaten her şeye
// yetkili olan bir rolün, altındaki öğretmen paneline erişememesi anlamsız olurdu.
// Öğretmen ise HEM role='teacher' HEM is_verified=true olmalı: role tek başına yeterli
// değil, kayıt olurken herkes bunu seçebilir — is_verified admin onayını temsil eder
// (bkz. app/src/components/admin/MembersTab.tsx, aynı alanı zaten yönetiyor). role
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
  if (row?.role === 'admin') return { ok: true, user, role: 'admin' };
  if (row?.role === 'teacher' && row.is_verified) return { ok: true, user, role: 'teacher' };
  return { ok: false, reason: row?.role === 'teacher' ? 'pending' : 'forbidden' };
}

export async function requireTeacher() {
  const access = await getTeacherAccess();
  if (!access.ok) {
    return access.reason === 'login'
      ? { ok: false as const, response: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) }
      : { ok: false as const, response: NextResponse.json({ error: 'Bu alan sadece onaylı öğretmenler içindir' }, { status: 403 }) };
  }
  return { ok: true as const, user: access.user, role: access.role };
}
