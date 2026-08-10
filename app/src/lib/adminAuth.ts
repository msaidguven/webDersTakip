import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

type ProfileRoleRow = { role: string | null };

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as ProfileRoleRow | null)?.role !== 'admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 }) };
  }

  return { ok: true as const, user };
}
