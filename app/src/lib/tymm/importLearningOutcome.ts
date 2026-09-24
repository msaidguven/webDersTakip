// app/src/lib/tymm/importLearningOutcome.ts
// TYMM'den TEK bir öğrenme çıktısını (kod ile), zaten var olan TEK bir DB konusuna aktarır.
// saveTymmUnit (importUnit.ts) ünitenin TÜM öğrenme çıktılarını sırayla işlerken, bu fonksiyon
// aynı grup bul-veya-oluştur + kazanım fuzzy-eşleştir/oluştur mantığını (bkz. importUnit.ts
// satır 236-310) TEK bir konu + TEK bir öğrenme çıktısı için tekrar eder — Kazanım Yönetimi
// panelinde "öğrenme çıktısı yok" bir konuya admin tek tıkla TYMM'deki karşılığını (ve altındaki
// tüm kazanımları) eklesin diye (kullanıcının 2026-09-24 isteği).

import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { fuzzyNorm } from './compareUnits';
import type { TymmLearningOutcome } from './tymmParser';

export type ImportLearningOutcomeResult =
  | { ok: true; learningOutcomeGroupId: number; outcomesCreated: number; outcomesMatched: number }
  | { ok: false; error: string };

export async function importLearningOutcomeIntoTopic(
  topicId: number,
  learningOutcome: TymmLearningOutcome,
  curriculumYear: string | null
): Promise<ImportLearningOutcomeResult> {
  const supabase = createServiceClient();

  const { data: topicRow, error: topicErr } = await supabase.from('topics').select('id, learning_outcome').eq('id', topicId).maybeSingle();
  if (topicErr) return { ok: false, error: topicErr.message };
  if (!topicRow) return { ok: false, error: 'Konu bulunamadı' };

  // Grubu koda göre bul-veya-oluştur (importUnit.ts ile aynı desen) — aynı öğrenme çıktısı
  // birden fazla kez "Ekle" ile tıklanırsa mükerrer grup oluşmasın diye.
  const { data: existingGroup, error: groupFindErr } = await supabase
    .from('topic_learning_outcomes')
    .select('id')
    .eq('topic_id', topicId)
    .eq('code', learningOutcome.code || '')
    .maybeSingle();
  if (groupFindErr) return { ok: false, error: groupFindErr.message };

  let learningOutcomeId: number;
  if (existingGroup) {
    learningOutcomeId = (existingGroup as { id: number }).id;
  } else {
    const { data: maxOrderRow } = await supabase
      .from('topic_learning_outcomes')
      .select('order_no')
      .eq('topic_id', topicId)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxOrderRow as { order_no: number } | null)?.order_no ?? 0) + 1;
    const { data: createdGroup, error: groupErr } = await supabase
      .from('topic_learning_outcomes')
      .insert({ topic_id: topicId, code: learningOutcome.code || null, title: learningOutcome.title, order_no: nextOrder })
      .select('id')
      .single();
    if (groupErr || !createdGroup) return { ok: false, error: groupErr?.message || 'Öğrenme çıktısı grubu oluşturulamadı' };
    learningOutcomeId = (createdGroup as { id: number }).id;
  }

  // Konunun learning_outcome (eski, serbest metin) alanı boşsa doldur — dolu bir değer
  // ASLA ezilmez (importUnit.ts'teki aynı kural, admin'in elle düzenlemesini korumak için).
  if (!(topicRow as { learning_outcome: string | null }).learning_outcome) {
    const text = learningOutcome.code ? `${learningOutcome.code}. ${learningOutcome.title}` : learningOutcome.title;
    await supabase.from('topics').update({ learning_outcome: text }).eq('id', topicId);
  }

  // Konunun BAĞSIZ (learning_outcome_id null) kazanımlarını da eşleştirme havuzuna dahil
  // ediyoruz — admin'in TYMM aktarımından önce elle girdiği veya eski (gruplama öncesi)
  // kazanımlar varsa, aynı metin bulununca yeni bir satır açmak yerine o satır bu gruba
  // BAĞLANIR (mükerrer kazanım oluşmasın diye).
  const { data: topicOutcomesData, error: outcomesFetchErr } = await supabase
    .from('outcomes')
    .select('id, description, learning_outcome_id')
    .eq('topic_id', topicId)
    .is('learning_outcome_id', null);
  if (outcomesFetchErr) return { ok: false, error: outcomesFetchErr.message };
  const unlinkedOutcomes = (topicOutcomesData as { id: number; description: string }[] | null) || [];

  let outcomesCreated = 0;
  let outcomesMatched = 0;

  for (const comp of learningOutcome.components) {
    const compFuzzy = fuzzyNorm(comp.text);
    const matchIdx = unlinkedOutcomes.findIndex((o) => fuzzyNorm(o.description) === compFuzzy);

    if (matchIdx !== -1) {
      const match = unlinkedOutcomes[matchIdx];
      const { error: updateErr } = await supabase
        .from('outcomes')
        .update({ description: comp.text, code: comp.letter, learning_outcome_id: learningOutcomeId, is_current: true })
        .eq('id', match.id);
      if (updateErr) return { ok: false, error: updateErr.message };
      unlinkedOutcomes.splice(matchIdx, 1);
      outcomesMatched += 1;
      continue;
    }

    const { data: maxIndexRow } = await supabase
      .from('outcomes')
      .select('order_index')
      .eq('topic_id', topicId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrderIndex = ((maxIndexRow as { order_index: number | null } | null)?.order_index ?? 0) + 1;

    const { error: insertErr } = await supabase.from('outcomes').insert({
      topic_id: topicId,
      description: comp.text,
      code: comp.letter,
      order_index: nextOrderIndex,
      curriculum_year: curriculumYear,
      learning_outcome_id: learningOutcomeId,
      is_current: true,
    });
    if (insertErr) return { ok: false, error: insertErr.message };
    outcomesCreated += 1;
  }

  return { ok: true, learningOutcomeGroupId: learningOutcomeId, outcomesCreated, outcomesMatched };
}
