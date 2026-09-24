// app/src/lib/tymm/buildTopicDiffs.ts
// TYMM'den parse edilmiş bir ünitenin, DB'deki mevcut haliyle konu/kazanım bazında ne
// kadar örtüştüğünü hesaplar — önizleme (tek ünite VE toplu akış) ile save (saveTymmUnit)
// AYNI eşleşme kuralını (fuzzy title/description) kullanmalı, yoksa önizleme kaydetmenin
// gerçekte yapacağından farklı bir şey gösterip admin'i yanıltır. Hem
// app/api/admin/tymm/fetch/route.ts (tek ünite) hem app/api/admin/tymm/fetch-bulk/route.ts
// (toplu — kullanıcının 2026-09-22 bulduğu bug: toplu akışta bu hesap hiç yapılmıyordu,
// "Karşılaştır ve Onayla" doğrudan kaydet adımına atlıyordu) burayı çağırır.

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { fuzzyNorm, normUnitTitleForMatch } from './compareUnits';
import type { TymmUnit } from './tymmParser';

export type TymmTopicDiff = {
  topicTitle: string;
  topicExists: boolean;
  topicId: number | null;
  unchanged: number;
  new: number;
  toArchive: number;
  newDescriptions: string[];
  toArchiveOutcomes: { id: number; description: string }[];
  dbTopicTitle: string | null;
  dbTopics: { id: number; title: string }[];
  samePairs: { parsedText: string; dbText: string; dbOutcomeId: number }[];
};

export async function buildTymmTopicDiffs(unit: TymmUnit, lessonId: number, gradeId: number): Promise<TymmTopicDiff[]> {
  const supabase = createServiceClient();

  // saveTymmUnit (importUnit.ts) ile AYNI ünite eşleştirme kuralı: birebir title yerine
  // normUnitTitleForMatch, TYMM'in bazen eklediği "1. Öğrenme Alanı: " gibi bir öneki yok
  // sayar.
  const { data: unitsForLessonGrade } = await supabase.from('units').select('id, title').eq('lesson_id', lessonId).eq('grade_id', gradeId);
  const normalizedUnitTarget = normUnitTitleForMatch(unit.unitTitle);
  const existingUnit = ((unitsForLessonGrade as { id: number; title: string }[] | null) || []).find(
    (u) => normUnitTitleForMatch(u.title) === normalizedUnitTarget
  );

  // Parse edilen ünitede her konu için TÜM kazanım metinlerini (birden fazla öğrenme çıktısı
  // aynı konuya düşebiliyor, bkz. importUnit.ts) tek bir set'te topla.
  const parsedDescsByTopic = new Map<string, Set<string>>();
  for (const lo of unit.learningOutcomes) {
    const set = parsedDescsByTopic.get(lo.topicTitle) || new Set<string>();
    for (const comp of lo.components) set.add(comp.text);
    parsedDescsByTopic.set(lo.topicTitle, set);
  }

  const topicTitles = Array.from(parsedDescsByTopic.keys());
  const diffs: TymmTopicDiff[] = [];

  if (!existingUnit) {
    for (const topicTitle of topicTitles) {
      const descs = Array.from(parsedDescsByTopic.get(topicTitle)!);
      diffs.push({
        topicTitle,
        topicExists: false,
        topicId: null,
        unchanged: 0,
        new: descs.length,
        toArchive: 0,
        newDescriptions: descs,
        toArchiveOutcomes: [],
        dbTopicTitle: null,
        dbTopics: [],
        samePairs: [],
      });
    }
    return diffs;
  }

  const unitId = (existingUnit as { id: number }).id;
  const { data: existingTopicsData } = await supabase.from('topics').select('id, title').eq('unit_id', unitId);
  const allDbTopics = (existingTopicsData as { id: number; title: string }[] | null) || [];
  const existingTopicIdByTitle = new Map<string, number>(allDbTopics.map((t) => [t.title, t.id]));
  const dbTopicsForUi = allDbTopics.map((t) => ({ id: t.id, title: t.title }));

  for (const topicTitle of topicTitles) {
    const parsedDescs = parsedDescsByTopic.get(topicTitle)!;
    // saveTymmUnit (importUnit.ts) İLE BİREBİR AYNI eşleşme sırası: birebir başlık, yoksa
    // FUZZY başlık.
    const topicId = existingTopicIdByTitle.get(topicTitle) ?? allDbTopics.find((t) => fuzzyNorm(t.title) === fuzzyNorm(topicTitle))?.id;
    const dbTopicTitle = topicId != null ? allDbTopics.find((t) => t.id === topicId)?.title ?? null : null;
    if (topicId == null) {
      const descs = Array.from(parsedDescs);
      diffs.push({
        topicTitle,
        topicExists: false,
        topicId: null,
        unchanged: 0,
        new: descs.length,
        toArchive: 0,
        newDescriptions: descs,
        toArchiveOutcomes: [],
        dbTopicTitle: null,
        dbTopics: dbTopicsForUi,
        samePairs: [],
      });
      continue;
    }

    const { data: activeOutcomesData } = await supabase.from('outcomes').select('id, description').eq('topic_id', topicId).eq('is_current', true);
    const activeOutcomes = (activeOutcomesData as { id: number; description: string }[] | null) || [];
    const activeByFuzzy = new Map(activeOutcomes.map((o) => [fuzzyNorm(o.description), o]));

    const newDescriptions: string[] = [];
    const samePairs: { parsedText: string; dbText: string; dbOutcomeId: number }[] = [];
    for (const desc of parsedDescs) {
      const dbMatch = activeByFuzzy.get(fuzzyNorm(desc));
      if (dbMatch) samePairs.push({ parsedText: desc, dbText: dbMatch.description, dbOutcomeId: dbMatch.id });
      else newDescriptions.push(desc);
    }
    const parsedDescsFuzzy = new Set(Array.from(parsedDescs).map(fuzzyNorm));
    const toArchiveOutcomes = activeOutcomes.filter((o) => !parsedDescsFuzzy.has(fuzzyNorm(o.description)));

    diffs.push({
      topicTitle,
      topicExists: true,
      topicId,
      unchanged: samePairs.length,
      new: newDescriptions.length,
      toArchive: toArchiveOutcomes.length,
      newDescriptions,
      toArchiveOutcomes,
      dbTopicTitle,
      dbTopics: dbTopicsForUi,
      samePairs,
    });
  }

  return diffs;
}
