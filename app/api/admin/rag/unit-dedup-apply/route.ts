import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type IncomingEdit = { section_id?: unknown; explanation_markdown?: unknown; notebook_markdown?: unknown };
type SectionOwnerRow = { id: number; topic_content_id: number };
type ContentOwnerRow = { id: number; topic_id: number };
type TopicIdRow = { id: number };

// unit-dedup-prompt/route.ts'in ürettiği promptun cevabını kaydeder. plan/route.ts'ten
// (tam üretim akışı) farklı olarak burada alt başlık EKLEME/SİLME yok — sadece var olan
// section_id'lerin body_markdown/notebook_markdown'ını günceller. Başlık ve section sayısı
// sabit kaldığı için görsel/diyagram/soru bağlantıları (section id'ye bağlı) etkilenmez.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { unitId?: unknown; edits?: IncomingEdit[]; ai_model?: unknown }
    | null;
  const unitId = Number(body?.unitId);
  const edits = body?.edits;
  const aiModel = typeof body?.ai_model === 'string' && body.ai_model.trim() ? body.ai_model.trim() : null;

  if (!Number.isFinite(unitId) || !Array.isArray(edits) || edits.length === 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const cleanEdits = edits
    .filter((e): e is IncomingEdit & { section_id: number } => typeof e?.section_id === 'number')
    .map((e) => ({
      sectionId: e.section_id,
      explanationMarkdown: typeof e.explanation_markdown === 'string' ? e.explanation_markdown.trim() : '',
      notebookMarkdown: typeof e.notebook_markdown === 'string' ? e.notebook_markdown.trim() : '',
    }));

  if (!cleanEdits.length) {
    return NextResponse.json({ error: 'Geçerli düzenleme bulunamadı' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verilen section_id'lerin GERÇEKTEN bu ünitenin konularına ait olduğunu doğruluyoruz —
  // admin panel her zaman kendi ürettiği unitId'yi gönderse de, section_id'ler dışarıdan
  // yapıştırılan bir JSON'dan geliyor; başka bir ünitenin içeriğinin yanlışlıkla ezilmesini
  // burada engelliyoruz.
  const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', unitId);
  const topicIds = ((topicRows as TopicIdRow[] | null) || []).map((t) => t.id);
  if (!topicIds.length) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const { data: contentRows } = await supabase.from('topic_contents').select('id, topic_id').in('topic_id', topicIds);
  const contentIds = ((contentRows as ContentOwnerRow[] | null) || []).map((c) => c.id);

  const sectionIds = cleanEdits.map((e) => e.sectionId);
  const { data: sectionOwnerRows } = contentIds.length
    ? await supabase.from('topic_content_sections').select('id, topic_content_id').in('id', sectionIds)
    : { data: [] as SectionOwnerRow[] };
  const validSectionIds = new Set(
    ((sectionOwnerRows as SectionOwnerRow[] | null) || [])
      .filter((s) => contentIds.includes(s.topic_content_id))
      .map((s) => s.id)
  );

  const toApply = cleanEdits.filter((e) => validSectionIds.has(e.sectionId));
  const skipped = cleanEdits.filter((e) => !validSectionIds.has(e.sectionId)).map((e) => e.sectionId);

  if (!toApply.length) {
    return NextResponse.json({ error: 'Gönderilen section_id\'lerin hiçbiri bu üniteye ait değil' }, { status: 400 });
  }

  const results = await Promise.all(
    toApply.map((e) =>
      supabase
        .from('topic_content_sections')
        .update({
          body_markdown: e.explanationMarkdown || null,
          notebook_markdown: e.notebookMarkdown || null,
          ...(aiModel ? { ai_model: aiModel } : {}),
        })
        .eq('id', e.sectionId)
    )
  );

  const failed = results.filter((r) => r.error);
  if (failed.length) {
    return NextResponse.json({ error: 'Bazı alt başlıklar güncellenemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: toApply.length, skipped });
}
