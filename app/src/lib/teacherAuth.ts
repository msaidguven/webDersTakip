import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type ProfileRoleRow = { role: string | null; is_verified: boolean | null };

// requireAdmin (adminAuth.ts) ile aynı desen. Admin da geçer — üstte zaten her şeye
// yetkili olan bir rolün, altındaki öğretmen paneline erişememesi anlamsız olurdu.
// Öğretmen ise HEM role='teacher' HEM is_verified=true olmalı: role tek başına yeterli
// değil, kayıt olurken herkes bunu seçebilir — is_verified admin onayını temsil eder
// (bkz. app/src/components/admin/MembersTab.tsx, aynı alanı zaten yönetiyor). role
// döndürülüyor ki çağıran route, "admin her şeyi görür ama öğretmen sadece kendi
// branşlarını görür" gibi bir ayrım yapabilsin (bkz. classical-questions/options).
export async function requireTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified')
    .eq('id', user.id)
    .maybeSingle();

  const row = profile as ProfileRoleRow | null;
  const isApprovedTeacher = row?.role === 'teacher' && !!row.is_verified;
  const isAdmin = row?.role === 'admin';

  if (!isApprovedTeacher && !isAdmin) {
    return { ok: false as const, response: NextResponse.json({ error: 'Bu alan sadece onaylı öğretmenler içindir' }, { status: 403 }) };
  }

  return { ok: true as const, user, role: isAdmin ? 'admin' as const : 'teacher' as const };
}
