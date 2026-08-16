import type { SupabaseClient } from '@supabase/supabase-js';

export type CascadeResult = { deletedIds: number[]; failed: { id: number; reason: string }[] };

type PgError = { code?: string; message: string } | null;

function friendlyError(error: PgError, fallback: string): string {
  if (!error) return fallback;
  if (error.code === '23503') return 'Bu kayıt başka verilerde kullanılıyor, önce bağlı kayıtları silin';
  return error.message || fallback;
}

// Çok sayıda id'yi (ör. bir sınıf+dersin tüm kazanımları) sınırsız paralellikle
// göndermek yerine sınırlı eşzamanlılıkla işler — hem tek tek sıralı işlemden çok
// daha hızlıdır hem de Supabase'e aynı anda yüzlerce istek açmayı engeller.
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

// Sorular: seçenek/boşluk/eşleştirme/klasik detaylarını ve bağlantı tablolarını silip
// ardından soruyu siler. Soru daha önce bir öğrenci tarafından cevaplanmışsa
// (test_session_answers vb.) FK ihlali oluşur; bunu admin'e okunabilir bir sebep olarak döneriz.
export async function deleteQuestionsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 10, async (id) => {
    await supabase.from('question_choices').delete().eq('question_id', id);
    await supabase.from('question_classical').delete().eq('question_id', id);
    await supabase.from('question_blank_options').delete().eq('question_id', id);
    await supabase.from('question_matching_pairs').delete().eq('question_id', id);
    await supabase.from('question_usages').delete().eq('question_id', id);
    await supabase.from('question_outcomes').delete().eq('question_id', id);

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      failed.push({ id, reason: error.code === '23503' ? 'Bu soru öğrenci geçmişinde kullanılmış, silinemiyor' : error.message });
    } else {
      deletedIds.push(id);
    }
  });

  return { deletedIds, failed };
}

export async function deleteOutcomesCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 10, async (id) => {
    await supabase.from('outcome_weeks').delete().eq('outcome_id', id);
    await supabase.from('topic_content_outcomes').delete().eq('outcome_id', id);
    await supabase.from('topic_content_section_outcomes').delete().eq('outcome_id', id);
    await supabase.from('question_outcomes').delete().eq('outcome_id', id);

    const { error } = await supabase.from('outcomes').delete().eq('id', id);
    if (error) failed.push({ id, reason: friendlyError(error, 'Kazanım silinemedi') });
    else deletedIds.push(id);
  });

  return { deletedIds, failed };
}

export async function deleteSectionsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 10, async (id) => {
    await supabase.from('topic_content_section_outcomes').delete().eq('section_id', id);

    const { error } = await supabase.from('topic_content_sections').delete().eq('id', id);
    if (error) failed.push({ id, reason: friendlyError(error, 'Alt başlık silinemedi') });
    else deletedIds.push(id);
  });

  return { deletedIds, failed };
}

export async function deleteTopicContentsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 10, async (id) => {
    const { data: sectionRows } = await supabase.from('topic_content_sections').select('id').eq('topic_content_id', id);
    const sectionIds = ((sectionRows as { id: number }[] | null) || []).map((r) => r.id);
    if (sectionIds.length) {
      await supabase.from('topic_content_section_outcomes').delete().in('section_id', sectionIds);
    }
    await supabase.from('topic_content_sections').delete().eq('topic_content_id', id);
    await supabase.from('topic_content_highlights').delete().eq('topic_content_id', id);
    await supabase.from('topic_content_tips').delete().eq('topic_content_id', id);
    await supabase.from('topic_content_weeks').delete().eq('topic_content_id', id);
    await supabase.from('topic_content_outcomes').delete().eq('topic_content_id', id);

    const { error } = await supabase.from('topic_contents').delete().eq('id', id);
    if (error) failed.push({ id, reason: friendlyError(error, 'İçerik silinemedi') });
    else deletedIds.push(id);
  });

  return { deletedIds, failed };
}

// Konu (topic) kalıcı silme: altındaki kazanımları, içerikleri (ve onların alt başlıklarını)
// ve soru bağlantılarını temizleyip konuyu siler. Öğrenci ilerleme kaydı (test_sessions vb.)
// varsa son adımda FK hatası alınır ve okunabilir bir sebep olarak döner.
export async function deleteTopicsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 5, async (id) => {
    try {
      const { data: outcomeRows } = await supabase.from('outcomes').select('id').eq('topic_id', id);
      const outcomeIds = ((outcomeRows as { id: number }[] | null) || []).map((r) => r.id);
      if (outcomeIds.length) await deleteOutcomesCascade(supabase, outcomeIds);

      const { data: contentRows } = await supabase.from('topic_contents').select('id').eq('topic_id', id);
      const contentIds = ((contentRows as { id: number }[] | null) || []).map((r) => r.id);
      if (contentIds.length) await deleteTopicContentsCascade(supabase, contentIds);

      await supabase.from('question_usages').delete().eq('topic_id', id);
      await supabase.from('user_topic_content_progress').delete().eq('topic_id', id);

      const { error } = await supabase.from('topics').delete().eq('id', id);
      if (error) failed.push({ id, reason: friendlyError(error, 'Konu silinemedi') });
      else deletedIds.push(id);
    } catch (e) {
      failed.push({ id, reason: e instanceof Error ? e.message : 'Bilinmeyen hata' });
    }
  });

  return { deletedIds, failed };
}

// Ünite kalıcı silme: önce altındaki tüm konuları (ve onların alt kayıtlarını) siler.
// Herhangi bir konu öğrenci verisi yüzünden silinemezse ünite de silinmez (yarım silme
// hiyerarşiyi bozar); bunun yerine kaç konunun engellendiğini bildiririz.
export async function deleteUnitsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  const deletedIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  await mapWithConcurrency(ids, 5, async (id) => {
    try {
      const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', id);
      const topicIds = ((topicRows as { id: number }[] | null) || []).map((r) => r.id);

      if (topicIds.length) {
        const sub = await deleteTopicsCascade(supabase, topicIds);
        if (sub.failed.length) {
          failed.push({ id, reason: `${sub.failed.length} konu öğrenci verisi nedeniyle silinemediği için ünite silinemedi` });
          return;
        }
      }

      await supabase.from('unit_videos').delete().eq('unit_id', id);

      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) failed.push({ id, reason: friendlyError(error, 'Ünite silinemedi') });
      else deletedIds.push(id);
    } catch (e) {
      failed.push({ id, reason: e instanceof Error ? e.message : 'Bilinmeyen hata' });
    }
  });

  return { deletedIds, failed };
}
