import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { YAZILI_IMAGE_BUCKET, YAZILI_IMAGE_RETENTION_DAYS } from '@/app/src/lib/yazili/attempts';

// Yazılı cevap fotoğraflarını saklama süresi (90 gün) dolunca siler — pg_cron her gün çağırır
// (bkz. supabase/migrations/yazili_attempt_images_cron.sql). Yazılı cevabın metni ve puanı kalır.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BATCH = 200;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - YAZILI_IMAGE_RETENTION_DAYS * 86400000).toISOString();

  const { data: old } = await supabase.from('yazili_attempts').select('id').lt('created_at', cutoff).limit(1000);
  const attemptIds = ((old as { id: number }[] | null) ?? []).map((a) => a.id);
  if (!attemptIds.length) return NextResponse.json({ deleted: 0 });

  const { data: rows } = await supabase
    .from('yazili_attempt_answers')
    .select('attempt_id, question_id, answer_image_path')
    .in('attempt_id', attemptIds)
    .not('answer_image_path', 'is', null)
    .limit(BATCH);
  const targets = (rows as { attempt_id: number; question_id: number; answer_image_path: string }[] | null) ?? [];
  if (!targets.length) return NextResponse.json({ deleted: 0 });

  const { error } = await supabase.storage.from(YAZILI_IMAGE_BUCKET).remove(targets.map((t) => t.answer_image_path));
  if (error) {
    console.error('yazili-foto-temizle: silinemedi', error.message);
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }
  await Promise.all(targets.map((t) =>
    supabase.from('yazili_attempt_answers').update({ answer_image_path: null }).eq('attempt_id', t.attempt_id).eq('question_id', t.question_id)
  ));
  return NextResponse.json({ deleted: targets.length });
}
