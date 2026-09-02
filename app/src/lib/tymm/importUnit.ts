// app/src/lib/tymm/importUnit.ts
// TYMM'den ÇEKİLMİŞ (ve admin tarafından elle düzeltilmiş olabilecek) bir ünite verisini
// DB'ye YAZAR — kendisi hiçbir ağ isteği yapmaz. Fetch (TYMM'den çekme) ve save (DB'ye
// yazma) bilerek ayrı tutuluyor: admin önce içeriği önizler/düzeltir, sonra elle onaylayıp
// kaydeder — hiçbir şey admin onayı olmadan DB'ye yazılmaz (bkz. proje sohbeti: aynı ünite
// farklı curriculum_year değerleriyle iki kez otomatik kaydedilince mükerrer kayıt oluşmuştu).

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { slugify } from '@/app/src/lib/yillikPlan/importer';
import type { TymmUnit } from './tymmParser';

type UnitRow = { id: number; order_no: number };
type TopicRow = { id: number };

export type SaveTymmUnitParams = {
  unit: TymmUnit;
  gradeId: number;
  lessonId: number;
  curriculumYear: string | null;
};

export type ImportUnitResult =
  | {
      ok: true;
      unitId: number;
      unitTitle: string;
      topicsCreated: number;
      outcomesCreated: number;
      outcomesSkipped: number;
    }
  | { ok: false; error: string };

export async function saveTymmUnit(params: SaveTymmUnitParams): Promise<ImportUnitResult> {
  const { unit, gradeId, lessonId, curriculumYear } = params;

  const supabase = createServiceClient();

  const { data: lgData } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  if (!lgData) {
    await supabase.from('lesson_grades').insert({ lesson_id: lessonId, grade_id: gradeId, is_active: true });
  }

  const unitTitle = unit.unitTitle;
  const { data: existingUnit } = await supabase
    .from('units')
    .select('id, order_no')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .eq('title', unitTitle)
    .maybeSingle();

  let unitId: number;
  if (existingUnit) {
    unitId = (existingUnit as UnitRow).id;
    await supabase.from('units').update({ duration_hours: unit.durationHours, key_concepts: unit.keyConcepts }).eq('id', unitId);
  } else {
    const { data: maxOrderData } = await supabase
      .from('units')
      .select('order_no')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxOrderData as UnitRow | null)?.order_no ?? 0) + 1;
    const slug = `${slugify(unitTitle)}-${lessonId}-${gradeId}`;
    const { data: created, error: insertError } = await supabase
      .from('units')
      .insert({
        lesson_id: lessonId,
        grade_id: gradeId,
        title: unitTitle,
        slug,
        order_no: nextOrder,
        is_active: false,
        description: `${unitTitle} ünitesi`,
        duration_hours: unit.durationHours,
        key_concepts: unit.keyConcepts,
      })
      .select('id')
      .single();
    if (insertError || !created) {
      return { ok: false, error: insertError?.message || 'Ünite oluşturulamadı' };
    }
    unitId = (created as { id: number }).id;
  }

  const { data: existingTopicsData } = await supabase.from('topics').select('id, title, order_no').eq('unit_id', unitId);
  const existingTopicByTitle = new Map<string, number>(
    ((existingTopicsData as { id: number; title: string; order_no: number }[] | null) || []).map((t) => [t.title, t.id])
  );
  let nextTopicOrder = Math.max(0, ...((existingTopicsData as { order_no: number }[] | null) || []).map((t) => t.order_no)) + 1;

  let topicsCreated = 0;
  let outcomesCreated = 0;
  let outcomesSkipped = 0;

  for (const learningOutcome of unit.learningOutcomes) {
    const topicTitle = learningOutcome.topicTitle;
    const learningOutcomeText = learningOutcome.code ? `${learningOutcome.code}. ${learningOutcome.title}` : learningOutcome.title;
    let topicId = existingTopicByTitle.get(topicTitle);
    if (topicId == null) {
      const { data: createdTopic, error: topicError } = await supabase
        .from('topics')
        .insert({
          unit_id: unitId,
          title: topicTitle,
          slug: slugify(topicTitle),
          order_no: nextTopicOrder,
          is_active: true,
          learning_outcome: learningOutcomeText,
        })
        .select('id')
        .single();
      if (topicError || !createdTopic) {
        return { ok: false, error: topicError?.message || `Konu oluşturulamadı: ${topicTitle}` };
      }
      topicId = (createdTopic as TopicRow & { id: number }).id;
      existingTopicByTitle.set(topicTitle, topicId);
      nextTopicOrder += 1;
      topicsCreated += 1;
    } else {
      await supabase.from('topics').update({ learning_outcome: learningOutcomeText }).eq('id', topicId);
    }

    for (const comp of learningOutcome.components) {
      let outcomeQuery = supabase.from('outcomes').select('id').eq('topic_id', topicId).eq('description', comp.text);
      outcomeQuery = curriculumYear ? outcomeQuery.eq('curriculum_year', curriculumYear) : outcomeQuery.is('curriculum_year', null);
      const { data: existingOutcome } = await outcomeQuery.maybeSingle();

      if (existingOutcome) {
        outcomesSkipped += 1;
        continue;
      }

      const { error: outcomeError } = await supabase
        .from('outcomes')
        .insert({ topic_id: topicId, description: comp.text, code: comp.letter, curriculum_year: curriculumYear });
      if (outcomeError) {
        return { ok: false, error: outcomeError.message };
      }
      outcomesCreated += 1;
    }
  }

  return { ok: true, unitId, unitTitle, topicsCreated, outcomesCreated, outcomesSkipped };
}
