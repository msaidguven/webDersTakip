import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Hesap silme isteği (POST) ve geri alma (DELETE). Hesap hemen silinmez: istek zamanı yazılır,
// 30 gün sonra /api/cron/hesap-silme kalıcı olarak siler (bkz. lib/accountDeletion.ts).
// Oturumu kapatmak istemcinin işi (AuthContext.signOut tüm cihazlardaki oturumu sonlandırır).
async function setDeletionRequest(requestedAt: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const service = createServiceClient();
  if (requestedAt) {
    const { data: row } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if ((row as { role: string | null } | null)?.role === 'admin') {
      return NextResponse.json({ error: 'Yönetici hesabı buradan silinemez' }, { status: 403 });
    }
  }

  const { error } = await service.from('profiles').update({ deletion_requested_at: requestedAt }).eq('id', user.id);
  if (error) {
    console.error('hesap-silme: istek yazılamadı', error.message, { userId: user.id });
    return NextResponse.json({ error: 'İşlem yapılamadı, tekrar dene' }, { status: 500 });
  }
  return NextResponse.json({ requestedAt });
}

export function POST() {
  return setDeletionRequest(new Date().toISOString());
}

export function DELETE() {
  return setDeletionRequest(null);
}
