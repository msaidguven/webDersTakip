import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, convertToWebp } from '@/app/src/lib/imageUpload';

const BUCKET = 'topic-content-images';

interface Params {
  sectionId: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
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

  const path = `sections/${sectionId}-${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, webpBuffer, { contentType: 'image/webp', upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Yükleme başarısız: ${uploadError.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const imageUrl = publicUrlData.publicUrl;

  const { data: sectionRow } = await supabase
    .from('topic_content_sections')
    .select('status')
    .eq('id', sectionId)
    .maybeSingle();

  const currentStatus = (sectionRow as { status: string } | null)?.status;
  const nextStatus = currentStatus === 'content_ready' ? 'image_ready' : undefined;

  const { error: updateError } = await supabase
    .from('topic_content_sections')
    .update({
      image_url: imageUrl,
      ...(nextStatus ? { status: nextStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sectionId);

  if (updateError) {
    return NextResponse.json({ error: `Kaydedilemedi: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imageUrl });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const supabase = createServiceClient();

  const { data: sectionRow } = await supabase
    .from('topic_content_sections')
    .select('status')
    .eq('id', sectionId)
    .maybeSingle();

  const currentStatus = (sectionRow as { status: string } | null)?.status;
  const nextStatus = currentStatus === 'image_ready' ? 'content_ready' : undefined;

  const { error } = await supabase
    .from('topic_content_sections')
    .update({
      image_url: null,
      ...(nextStatus ? { status: nextStatus } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sectionId);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
