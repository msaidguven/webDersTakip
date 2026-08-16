import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  CONTENT_IMAGE_BUCKET,
  buildHeroFolderPrefix,
  buildSectionFolderPrefix,
  extractHierarchy,
} from '@/app/src/lib/contentImageStorage';

const BUCKET = CONTENT_IMAGE_BUCKET;

type Kind = 'hero' | 'section';

// topicId üzerinden bu konunun ünitesini (ve dolayısıyla galeri klasörünü) çözer.
async function resolveUnitFromTopic(supabase: ReturnType<typeof createServiceClient>, topicId: string) {
  const { data: topic } = await supabase
    .from('topics')
    .select('unit_id, units(slug, grades(slug), lessons(slug))')
    .eq('id', topicId)
    .maybeSingle();

  if (!topic) return null;

  type TopicRow = { unit_id: number; units: Parameters<typeof extractHierarchy>[0] };
  const row = topic as unknown as TopicRow;
  const hierarchy = extractHierarchy(row.units, row.unit_id);
  return hierarchy ? { hierarchy, unitId: row.unit_id } : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  const kind = request.nextUrl.searchParams.get('kind') as Kind | null;
  if (!topicId || (kind !== 'hero' && kind !== 'section')) {
    return NextResponse.json({ error: 'topicId ve kind (hero|section) gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const resolved = await resolveUnitFromTopic(supabase, topicId);
  if (!resolved) {
    return NextResponse.json({ error: 'Bu konu için sınıf/ders/ünite bilgisi çözümlenemedi' }, { status: 400 });
  }
  const { hierarchy, unitId } = resolved;

  const prefix = kind === 'hero' ? buildHeroFolderPrefix(hierarchy) : buildSectionFolderPrefix(hierarchy);

  const { data: files, error: listError } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (listError) {
    return NextResponse.json({ error: `Galeri listelenemedi: ${listError.message}` }, { status: 500 });
  }

  // Ünitedeki tüm topic_content'leri bul (hem hero hem section kullanım kontrolü için gerekli).
  const { data: topicsInUnit } = await supabase.from('topics').select('id').eq('unit_id', unitId);
  const topicIds = (topicsInUnit ?? []).map((t) => (t as { id: number }).id);

  const usedUrls = new Set<string>();
  if (topicIds.length) {
    const { data: contents } = await supabase
      .from('topic_contents')
      .select('id, hero_image_url')
      .in('topic_id', topicIds);
    const contentRows = (contents ?? []) as { id: number; hero_image_url: string | null }[];

    if (kind === 'hero') {
      contentRows.forEach((c) => c.hero_image_url && usedUrls.add(c.hero_image_url));
    } else {
      const contentIds = contentRows.map((c) => c.id);
      if (contentIds.length) {
        const { data: sections } = await supabase
          .from('topic_content_sections')
          .select('image_url')
          .in('topic_content_id', contentIds);
        (sections ?? []).forEach((s) => {
          const url = (s as { image_url: string | null }).image_url;
          if (url) usedUrls.add(url);
        });
      }
    }
  }

  const items = (files ?? [])
    .filter((f) => f.name && f.id) // klasörleri (id=null) değil sadece dosyaları al
    .map((f) => {
      const path = `${prefix}/${f.name}`;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      return { path, url, inUse: usedUrls.has(url), createdAt: f.created_at };
    })
    .sort((a, b) => {
      if (a.inUse !== b.inUse) return a.inUse ? 1 : -1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  return NextResponse.json({ items });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'path gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const [{ count: heroCount }, { count: sectionCount }] = await Promise.all([
    supabase.from('topic_contents').select('id', { count: 'exact', head: true }).eq('hero_image_url', url),
    supabase.from('topic_content_sections').select('id', { count: 'exact', head: true }).eq('image_url', url),
  ]);

  if ((heroCount ?? 0) > 0 || (sectionCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Bu görsel hâlâ kullanımda, önce ilgili yerden kaldırın' }, { status: 409 });
  }

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    return NextResponse.json({ error: `Silinemedi: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
