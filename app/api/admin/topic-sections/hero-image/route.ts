import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, convertToWebp } from '@/app/src/lib/imageUpload';
import { CONTENT_IMAGE_BUCKET, buildHeroFolderPrefix, buildHeroImagePath, extractHierarchy } from '@/app/src/lib/contentImageStorage';

const BUCKET = CONTENT_IMAGE_BUCKET;

export async function POST(request: NextRequest) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error('hero-image POST failed', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Sunucu hatası: ${message}` }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const existingPath = formData?.get('existingPath');
  const topicContentId = formData?.get('topicContentId');

  if (!topicContentId || typeof topicContentId !== 'string') {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: contentRow } = await supabase
    .from('topic_contents')
    .select('topics(unit_id, units(slug, grades(slug), lessons(slug)))')
    .eq('id', topicContentId)
    .maybeSingle();

  if (!contentRow) {
    return NextResponse.json({ error: 'İçerik bulunamadı' }, { status: 404 });
  }

  type ContentHierarchyRow = {
    topics: { unit_id: number; units: Parameters<typeof extractHierarchy>[0] } | null;
  };
  const topics = (contentRow as unknown as ContentHierarchyRow).topics;
  const hierarchy = topics ? extractHierarchy(topics.units, topics.unit_id) : null;

  if (!hierarchy) {
    return NextResponse.json({ error: 'Bu içerik için sınıf/ders/ünite bilgisi çözümlenemedi' }, { status: 400 });
  }

  let imageUrl: string;

  if (typeof existingPath === 'string' && existingPath) {
    // Galeriden seçim: dosya zaten storage'da, sadece bu ünitenin kapak klasörüne ait olduğunu doğrulayıp bağla.
    if (!existingPath.startsWith(`${buildHeroFolderPrefix(hierarchy)}/`)) {
      return NextResponse.json({ error: 'Geçersiz galeri görseli' }, { status: 400 });
    }
    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(existingPath).data.publicUrl;
  } else {
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
    } catch (err) {
      console.error('convertToWebp failed', err);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Görsel işlenemedi: ${message}` }, { status: 400 });
    }

    const path = buildHeroImagePath(hierarchy, topicContentId);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([new Uint8Array(webpBuffer)], { type: 'image/webp' }), { contentType: 'image/webp', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Yükleme başarısız: ${uploadError.message}` }, { status: 500 });
    }

    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

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

  // Dosya storage'dan silinmiyor — galeri için kalıyor. Kalıcı silme sadece
  // image-gallery DELETE'i ile yapılır.
  const { error } = await supabase
    .from('topic_contents')
    .update({ hero_image_url: null })
    .eq('id', topicContentId);

  if (error) {
    return NextResponse.json({ error: 'Silinemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
