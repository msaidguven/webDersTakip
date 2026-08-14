import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const EDITABLE_FIELDS = ['full_name', 'grade_id', 'city_id', 'district_id', 'school_id', 'school_name'] as const;

// Kullanıcının kendi profilini güncellemesi için: oturumu doğrular, sadece kendi
// satırını (id = session user id) günceller. profiles tablosunda kullanıcı bazlı
// UPDATE RLS politikası olmadığından yetki kontrolünü burada, uygulama katmanında yapıyoruz.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { patch?: unknown } | null;
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;
  if (!rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from('profiles').update(patch).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
