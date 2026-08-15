import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { slugifyHeading } from '@/app/src/lib/site';
import { recalculateUnitWeeks } from '@/app/src/lib/recalculateUnitWeeks';

type ImportOutcome = { code?: unknown; description?: unknown };
type ImportTopic = { title?: unknown; curriculum_code?: unknown; outcomes?: unknown };
type ImportUnit = { title?: unknown; curriculum_code?: unknown; duration_hours?: unknown; topics?: unknown };
type ImportBody = { lessonId?: unknown; gradeId?: unknown; unit?: unknown };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

async function uniqueSlug(supabase: ReturnType<typeof createServiceClient>, table: 'units' | 'topics', base: string): Promise<string> {
  const baseSlug = slugifyHeading(base) || 'konu';
  let slug = baseSlug;
  let attempt = 2;
  // Aynı slug'a sahip küçük bir tablo taraması yeterli, üniteler/konular yüksek hacimli değil.
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

  const body = (await request.json().catch(() => null)) as ImportBody | null;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  const unitInput = body?.unit as ImportUnit | undefined;

  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId) || !unitInput) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  if (!isNonEmptyString(unitInput.title)) {
    return NextResponse.json({ error: 'Ünite başlığı zorunlu' }, { status: 400 });
  }
  const durationHours = Number(unitInput.duration_hours);
  if (!Number.isFinite(durationHours) || durationHours < 1) {
    return NextResponse.json({ error: 'Ünite süresi (duration_hours) zorunlu ve pozitif olmalı' }, { status: 400 });
  }
  const topicsInput = Array.isArray(unitInput.topics) ? (unitInput.topics as ImportTopic[]) : [];
  if (!topicsInput.length) {
    return NextResponse.json({ error: 'En az bir konu (topic) gerekli' }, { status: 400 });
  }
  for (const t of topicsInput) {
    if (!isNonEmptyString(t.title)) {
      return NextResponse.json({ error: 'Her konunun başlığı zorunlu' }, { status: 400 });
    }
  }

  const supabase = createServiceClient();
  const warnings: string[] = [];

  // Aktif/pasif farketmeksizin aynı ders+sınıfta aynı başlıkta ünite varsa engelle —
  // pasif üniteler (henüz içeriği yazılmamış, yeni içe aktarılmış) de dahil, aksi halde
  // aynı JSON yanlışlıkla iki kez kaydedilirse sessizce kopya oluşurdu.
  const { data: existingSameTitle } = await supabase
    .from('units')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .eq('title', unitInput.title)
    .limit(1);
  if (existingSameTitle && existingSameTitle.length) {
    return NextResponse.json(
      { error: `"${unitInput.title}" başlığında bu ders+sınıfta zaten bir ünite var. Önce onu silin/pasifleştirin veya farklı bir başlık kullanın.` },
      { status: 409 }
    );
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

  const unitSlug = await uniqueSlug(supabase, 'units', unitInput.title);

  const { data: insertedUnit, error: unitError } = await supabase
    .from('units')
    .insert({
      lesson_id: lessonId,
      grade_id: gradeId,
      title: unitInput.title,
      curriculum_code: isNonEmptyString(unitInput.curriculum_code) ? unitInput.curriculum_code : null,
      duration_hours: durationHours,
      order_no: nextOrderNo,
      slug: unitSlug,
      is_active: false,
    })
    .select('id')
    .single();

  if (unitError || !insertedUnit) {
    return NextResponse.json({ error: unitError?.message || 'Ünite oluşturulamadı' }, { status: 500 });
  }
  const unitId = (insertedUnit as { id: number }).id;

  const createdTopics: { id: number; outcomeIds: number[] }[] = [];

  for (let i = 0; i < topicsInput.length; i++) {
    const t = topicsInput[i];
    const topicSlug = await uniqueSlug(supabase, 'topics', t.title as string);

    const { data: insertedTopic, error: topicError } = await supabase
      .from('topics')
      .insert({
        unit_id: unitId,
        title: t.title,
        curriculum_code: isNonEmptyString(t.curriculum_code) ? t.curriculum_code : null,
        order_no: i,
        slug: topicSlug,
        is_active: false,
      })
      .select('id')
      .single();

    if (topicError || !insertedTopic) {
      return NextResponse.json(
        {
          error: topicError?.message || 'Konu oluşturulamadı',
          partial: { unitId, createdTopics },
        },
        { status: 500 }
      );
    }
    const topicId = (insertedTopic as { id: number }).id;

    const outcomesInput = Array.isArray(t.outcomes) ? (t.outcomes as ImportOutcome[]) : [];
    const outcomeIds: number[] = [];
    for (let j = 0; j < outcomesInput.length; j++) {
      const o = outcomesInput[j];
      if (!isNonEmptyString(o.description)) continue;
      const { data: insertedOutcome, error: outcomeError } = await supabase
        .from('outcomes')
        .insert({
          topic_id: topicId,
          code: isNonEmptyString(o.code) ? o.code : null,
          description: o.description,
          order_index: j,
        })
        .select('id')
        .single();

      if (outcomeError || !insertedOutcome) {
        return NextResponse.json(
          {
            error: outcomeError?.message || 'Kazanım oluşturulamadı',
            partial: { unitId, createdTopics: [...createdTopics, { id: topicId, outcomeIds }] },
          },
          { status: 500 }
        );
      }
      outcomeIds.push((insertedOutcome as { id: number }).id);
    }

    createdTopics.push({ id: topicId, outcomeIds });
  }

  const weekRecalc = await recalculateUnitWeeks(supabase, lessonId, gradeId);

  return NextResponse.json({
    unit: { id: unitId, topics: createdTopics },
    warnings,
    weekRecalc,
  });
}
