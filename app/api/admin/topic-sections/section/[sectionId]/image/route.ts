import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE, convertToWebp } from '@/app/src/lib/imageUpload';
import { CONTENT_IMAGE_BUCKET, buildSectionFolderPrefix, buildSectionImagePath, extractHierarchy } from '@/app/src/lib/contentImageStorage';

const BUCKET = CONTENT_IMAGE_BUCKET;

interface Params {
  sectionId: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const existingPath = formData?.get('existingPath');

  const supabase = createServiceClient();

  const { data: sectionRow } = await supabase
    .from('topic_content_sections')
    .select('status, topic_contents(topics(unit_id, units(slug, grades(slug), lessons(slug))))')
    .eq('id', sectionId)
    .maybeSingle();

  if (!sectionRow) {
    return NextResponse.json({ error: 'Bölüm bulunamadı' }, { status: 404 });
  }

  type SectionHierarchyRow = {
    status: string;
    topic_contents: { topics: { unit_id: number; units: Parameters<typeof extractHierarchy>[0] } | null } | null;
  };
  const row = sectionRow as unknown as SectionHierarchyRow;
  const topics = row.topic_contents?.topics ?? null;
  const hierarchy = topics ? extractHierarchy(topics.units, topics.unit_id) : null;

  if (!hierarchy) {
    return NextResponse.json({ error: 'Bu bölüm için sınıf/ders/ünite bilgisi çözümlenemedi' }, { status: 400 });
  }

  let imageUrl: string;

  if (typeof existingPath === 'string' && existingPath) {
    // Galeriden seçim: dosya zaten storage'da, sadece bu bölümün klasörüne ait olduğunu doğrulayıp bağla.
    if (!existingPath.startsWith(`${buildSectionFolderPrefix(hierarchy)}/`)) {
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
    } catch {
      return NextResponse.json({ error: 'Görsel işlenemedi. Dosya bozuk olabilir.' }, { status: 400 });
    }

    const path = buildSectionImagePath(hierarchy, sectionId);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([new Uint8Array(webpBuffer)], { type: 'image/webp' }), { contentType: 'image/webp', upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Yükleme başarısız: ${uploadError.message}` }, { status: 500 });
    }

    imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const currentStatus = row.status;
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null) as { image_prompt?: unknown; image_alt?: unknown } | null;

  if (!body || typeof body.image_prompt !== 'string' || !body.image_prompt.trim()) {
    return NextResponse.json({ error: 'Geçersiz görsel promptu' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('topic_content_sections')
    .update({
      image_prompt: body.image_prompt.trim(),
      image_alt: typeof body.image_alt === 'string' && body.image_alt.trim() ? body.image_alt.trim() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sectionId);

  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
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

  // Dosya storage'dan silinmiyor — galeri için kalıyor, isterse başka bir bölüme
  // veya tekrar buna bağlanabilir. Kalıcı silme sadece image-gallery DELETE'i ile yapılır.
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
