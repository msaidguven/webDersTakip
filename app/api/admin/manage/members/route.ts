import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const EDITABLE_FIELDS = ['full_name', 'username', 'role', 'grade_id', 'school_name', 'branch', 'is_verified'] as const;
const BAN_DURATION = '87600h'; // ~10 yıl — kalıcıya yakın ama tersine çevrilebilir "pasifleştirme"

type AuthUserLite = { id: string; email?: string; banned_until?: string | null };

async function loadAuthUserMap(supabase: ReturnType<typeof createServiceClient>) {
  const map = new Map<string, { email: string | null; banned: boolean }>();
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error || !data) return map;
    for (const u of data.users as AuthUserLite[]) {
      const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
      map.set(u.id, { email: u.email || null, banned });
    }
  } catch {
    // auth.admin erişilemezse (yanlış servis anahtarı vb.) e-posta/ban bilgisi olmadan devam et
  }
  return map;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const search = request.nextUrl.searchParams.get('search');
  const role = request.nextUrl.searchParams.get('role');

  let query = supabase
    .from('profiles')
    .select('id, full_name, username, role, grade_id, school_name, branch, is_verified, banned_reason, updated_at, grades(name)')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (role) query = query.eq('role', role);
  if (search) query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%`);

  const [{ data: profiles, error }, authMap] = await Promise.all([query, loadAuthUserMap(supabase)]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((profiles as Record<string, unknown>[] | null) || []).map((p) => {
    const auth = authMap.get(p.id as string);
    return { ...p, email: auth?.email ?? null, banned: auth?.banned ?? false };
  });

  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; patch?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : [];
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;

  if (!ids.length || !rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  if ('role' in rawPatch && ids.includes(admin.user.id)) {
    return NextResponse.json({ error: 'Kendi rolünüzü buradan değiştiremezsiniz' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('profiles').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; hard?: unknown; unban?: unknown; reason?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  if (ids.includes(admin.user.id)) {
    return NextResponse.json({ error: 'Kendi hesabınız üzerinde bu işlemi yapamazsınız' }, { status: 400 });
  }

  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

  const supabase = createServiceClient();
  const deletedIds: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const id of ids) {
    if (body?.hard === true) {
      const { error } = await supabase.auth.admin.deleteUser(id);
      if (error) {
        failed.push({ id, reason: error.message });
        continue;
      }
      await supabase.from('profiles').delete().eq('id', id);
      deletedIds.push(id);
    } else {
      const unban = body?.unban === true;
      const { error } = await supabase.auth.admin.updateUserById(id, {
        ban_duration: unban ? 'none' : BAN_DURATION,
      });
      if (error) {
        failed.push({ id, reason: error.message });
        continue;
      }

      // is_banned kolonu, auth.users.banned_until'ın middleware'de ucuz şekilde
      // okunabilen bir aynası — banned_until yeni sign-in/refresh'i zaten engelliyor,
      // bu kolon ise hâlâ geçerli olan access token'la gezinen kullanıcıyı sayfa
      // isteklerinde yakalamak için (bkz. middleware.ts).
      await supabase
        .from('profiles')
        .update(
          unban
            ? { is_banned: false, banned_at: null, banned_reason: null, banned_by: null }
            : { is_banned: true, banned_at: new Date().toISOString(), banned_reason: reason, banned_by: admin.user.id }
        )
        .eq('id', id);

      deletedIds.push(id);
    }
  }

  return NextResponse.json({ deletedIds, failed });
}
