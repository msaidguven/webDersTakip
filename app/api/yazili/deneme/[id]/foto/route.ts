import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { loadAttemptRow, YAZILI_IMAGE_BUCKET } from '@/app/src/lib/yazili/attempts';

// Yazılı cevabına kâğıt fotoğrafı ekler/kaldırır (2026-10-27). İstemci fotoğrafı JPEG'e çevirip küçültür (EXIF/konum
// bilgisi de böylece düşer); burada yine de JPEG imzası ve boyut doğrulanır. Dosya özel depoda tutulur
// (bkz. supabase/migrations/yazili_attempt_images.sql); yalnız puanlanmamış ve kendi denemesine eklenebilir.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MAX_BYTES = 3 * 1024 * 1024;

async function authorize(request: NextRequest, idParam: string) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 }) };
  const attemptId = Number(idParam);
  const questionId = Number(request.nextUrl.searchParams.get('soru'));
  if (!Number.isInteger(attemptId) || !Number.isInteger(questionId)) return { error: NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) };
  const loaded = await loadAttemptRow(attemptId);
  if (!loaded || loaded.attempt.user_id !== user.id || !loaded.answers.some((a) => a.question_id === questionId)) {
    return { error: NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 }) };
  }
  if (loaded.attempt.status === 'graded') return { error: NextResponse.json({ error: 'Puanlanmış yazılıya fotoğraf eklenemez' }, { status: 409 }) };
  return { userId: user.id, attemptId, questionId };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request, (await params).id);
  if ('error' in auth) return auth.error;

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return NextResponse.json({ error: 'Fotoğraf çok büyük' }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return NextResponse.json({ error: 'Fotoğraf çok büyük ya da boş' }, { status: 413 });
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return NextResponse.json({ error: 'Yalnız JPEG kabul edilir' }, { status: 415 });

  const path = `${auth.userId}/${auth.attemptId}/${auth.questionId}.jpg`;
  const supabase = createServiceClient();
  const { error: uploadError } = await supabase.storage.from(YAZILI_IMAGE_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    console.error('[yazili/foto] yüklenemedi:', uploadError.message);
    return NextResponse.json({ error: 'Fotoğraf yüklenemedi, tekrar dene.' }, { status: 500 });
  }
  const { error } = await supabase.from('yazili_attempt_answers').update({ answer_image_path: path }).eq('attempt_id', auth.attemptId).eq('question_id', auth.questionId);
  if (error) return NextResponse.json({ error: 'Fotoğraf kaydedilemedi' }, { status: 500 });

  const { data: signed } = await supabase.storage.from(YAZILI_IMAGE_BUCKET).createSignedUrl(path, 3600);
  return NextResponse.json({ imageUrl: signed?.signedUrl ?? null });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request, (await params).id);
  if ('error' in auth) return auth.error;
  const supabase = createServiceClient();
  await supabase.storage.from(YAZILI_IMAGE_BUCKET).remove([`${auth.userId}/${auth.attemptId}/${auth.questionId}.jpg`]);
  await supabase.from('yazili_attempt_answers').update({ answer_image_path: null }).eq('attempt_id', auth.attemptId).eq('question_id', auth.questionId);
  return NextResponse.json({ ok: true });
}
