import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { slugifyHeading } from '@/app/src/lib/site';
import { recalculateUnitWeeks } from '@/app/src/lib/recalculateUnitWeeks';
import type { UnitImportPayload } from '@/app/src/lib/mebScraper';

async function uniqueSlug(supabase: ReturnType<typeof createServiceClient>, table: 'units' | 'topics', base: string): Promise<string> {
  const baseSlug = slugifyHeading(base) || 'konu';
  let slug = baseSlug;
  let attempt = 2;
  while (true) {
    const { data } = await supabase.from(table).select('id').eq('slug', slug).limit(1);
    if (!data || !data.length) return slug;
    slug = `${baseSlug}-${attempt}`;
    attempt++;
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { lessonId?: unknown; gradeId?: unknown; units?: unknown }
    | null;

  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);
  const units = Array.isArray(body?.units) ? (body.units as UnitImportPayload[]) : [];

  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId) || !units.length) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const created: { id: number; title: string }[] = [];
  const skipped: { title: string; reason: string }[] = [];

  for (const unit of units) {
    if (!unit || typeof unit.title !== 'string' || !unit.title.trim() || !Array.isArray(unit.topics) || !unit.topics.length) {
      skipped.push({ title: unit?.title || '(başlıksız)', reason: 'Geçersiz ünite verisi' });
      continue;
    }

    // Bulk taramadan sonra araya elle/başka bir işlemle aynı başlıkta ünite eklenmiş
    // olabilir — kaydetmeden hemen önce defansif tekrar kontrolü.
    const { data: existing } = await supabase
      .from('units')
      .select('id')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .eq('title', unit.title)
      .limit(1);
    if (existing && existing.length) {
      skipped.push({ title: unit.title, reason: 'Bu başlıkta zaten bir ünite var' });
      continue;
    }

    const { data: maxOrderRow } = await supabase
      .from('units')
      .select('order_no')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrderNo = ((maxOrderRow as { order_no: number } | null)?.order_no ?? -1) + 1;

    const unitSlug = await uniqueSlug(supabase, 'units', unit.title);

    const { data: insertedUnit, error: unitError } = await supabase
      .from('units')
      .insert({
        lesson_id: lessonId,
        grade_id: gradeId,
        title: unit.title,
        curriculum_code: unit.curriculum_code || null,
        duration_hours: unit.duration_hours,
        order_no: nextOrderNo,
        slug: unitSlug,
        is_active: false,
      })
      .select('id')
      .single();

    if (unitError || !insertedUnit) {
      skipped.push({ title: unit.title, reason: unitError?.message || 'Ünite oluşturulamadı' });
      continue;
    }
    const unitId = (insertedUnit as { id: number }).id;

    let topicError: string | null = null;
    for (let i = 0; i < unit.topics.length; i++) {
      const t = unit.topics[i];
      const topicSlug = await uniqueSlug(supabase, 'topics', t.title);

      const { data: insertedTopic, error: tErr } = await supabase
        .from('topics')
        .insert({
          unit_id: unitId,
          title: t.title,
          curriculum_code: t.curriculum_code || null,
          order_no: i,
          slug: topicSlug,
          is_active: false,
        })
        .select('id')
        .single();

      if (tErr || !insertedTopic) {
        topicError = tErr?.message || 'Konu oluşturulamadı';
        break;
      }
      const topicId = (insertedTopic as { id: number }).id;

      for (let j = 0; j < (t.outcomes || []).length; j++) {
        const o = t.outcomes[j];
        if (!o?.description) continue;
        const { error: oErr } = await supabase.from('outcomes').insert({
          topic_id: topicId,
          code: o.code || null,
          description: o.description,
          order_index: j,
        });
        if (oErr) {
          topicError = oErr.message;
          break;
        }
      }
      if (topicError) break;
    }

    if (topicError) {
      skipped.push({ title: unit.title, reason: `Kısmi eklendi (id ${unitId}), elden kontrol edin: ${topicError}` });
      continue;
    }

    created.push({ id: unitId, title: unit.title });
  }

  const weekRecalc = created.length ? await recalculateUnitWeeks(supabase, lessonId, gradeId) : { updated: [], warnings: [] };

  return NextResponse.json({ created, skipped, weekRecalc });
}
