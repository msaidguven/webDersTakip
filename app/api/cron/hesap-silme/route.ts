import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@/app/src/lib/accountDeletion';
import { YAZILI_IMAGE_BUCKET } from '@/app/src/lib/yazili/attempts';

// Silme isteğinin üzerinden 30 gün geçen hesapları kalıcı olarak siler — pg_cron her gün, yalnız süresi
// dolan hesap varsa çağırır (bkz. supabase/migrations/account_deletion_30_days.sql).
// Önce üyenin dosyaları (Storage satırları SQL ile silinemez), sonra auth kullanıcısı silinir; veritabanındaki
// kayıtları auth.users → profiles bağları üzerinden kendiliğinden gider. Dosyası silinemeyen hesap
// atlanır, ertesi gün yeniden denenir.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BATCH = 20;
const AVATAR_EXTS = ['webp', 'jpg', 'jpeg', 'png', 'gif'];

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - ACCOUNT_DELETION_GRACE_DAYS * 86400000).toISOString();

  const { data: due, error } = await supabase
    .from('profiles')
    .select('id')
    .lt('deletion_requested_at', cutoff)
    .or('role.is.null,role.neq.admin')
    .limit(BATCH);
  if (error) {
    console.error('hesap-silme: liste okunamadı', error.message);
    return NextResponse.json({ error: 'Liste okunamadı' }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;
  for (const { id } of (due as { id: string }[] | null) ?? []) {
    const { data: photos } = await supabase
      .from('yazili_attempt_answers')
      .select('answer_image_path')
      .like('answer_image_path', `${id}/%`);
    const photoPaths = ((photos as { answer_image_path: string }[] | null) ?? []).map((p) => p.answer_image_path);

    const results = await Promise.all([
      photoPaths.length ? supabase.storage.from(YAZILI_IMAGE_BUCKET).remove(photoPaths) : null,
      supabase.storage.from('profiles').remove(AVATAR_EXTS.map((ext) => `avatars/${id}.${ext}`)),
    ]);
    const storageError = results.find((r) => r?.error)?.error;
    const deleteError = storageError ?? (await supabase.auth.admin.deleteUser(id)).error;
    if (deleteError) {
      failed += 1;
      console.error('hesap-silme: hesap silinemedi', deleteError.message, { userId: id });
    } else {
      deleted += 1;
    }
  }
  return NextResponse.json({ deleted, failed });
}
