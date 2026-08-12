import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, convertToWebp } from '@/app/src/lib/imageUpload';

const BUCKET = 'topic-content-images';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const topicContentId = formData?.get('topicContentId');

  if (!topicContentId || typeof topicContentId !== 'string') {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Sadece PNG, JPEG, WEBP veya GIF yükleyebilirsiniz' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'Dosya 4MB\'tan büyük olamaz' }, { status: 400 });
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await convertToWebp(file);
  } catch {
    return NextResponse.json({ error: 'Görsel işlenemedi. Dosya bozuk olabilir.' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const path = `hero/${topicContentId}-${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([new Uint8Array(webpBuffer)], { type: 'image/webp' }), { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Yükleme başarısız: ${uploadError.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from('topic_contents')
    .update({ hero_image_url: imageUrl })
    .eq('id', topicContentId);

  if (updateError) {
    return NextResponse.json({ error: `Kaydedilemedi: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imageUrl });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicContentId = request.nextUrl.searchParams.get('topicContentId');
  if (!topicContentId) {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('topic_contents')
    .update({ hero_image_url: null })
    .eq('id', topicContentId);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
