import type { SupabaseClient } from '@supabase/supabase-js';

export type CascadeResult = { deletedIds: number[]; failed: { id: number; reason: string }[] };

type RpcRow = { item_id: number; success: boolean; reason: string | null };

// Gerçek cascade mantığı artık veritabanında: FK'lar ON DELETE CASCADE/SET NULL ile
// tanımlı, ve her admin_delete_*_cascade fonksiyonu id başına atomik çalışıyor (bir id
// öğrenci verisi yüzünden engellenirse SADECE o id rollback olur, diğerleri etkilenmez).
// Bkz. supabase/migrations/admin_cascade_delete.sql. Burada sadece RPC'yi çağırıp
// sonucu mevcut CascadeResult sözleşmesine ve Türkçe hata mesajlarına çeviriyoruz.
async function runCascadeRpc(
  supabase: SupabaseClient,
  fn: string,
  ids: number[],
  friendlyReason: string,
  // force-delete zaten beklenmedik bir engelle karşılaşmamalı; SQLERRM'i saklayıp
  // genel mesajın yerine gösteriyoruz ki admin panelde gerçek sebep görünsün.
  useRawReason = false
): Promise<CascadeResult> {
  if (!ids.length) return { deletedIds: [], failed: [] };

  const { data, error } = await supabase.rpc(fn, { p_ids: ids });
  if (error) throw error;

  const rows = (data ?? []) as RpcRow[];
  const deletedIds = rows.filter((r) => r.success).map((r) => r.item_id);
  const failed = rows
    .filter((r) => !r.success)
    .map((r) => ({ id: r.item_id, reason: useRawReason ? r.reason || friendlyReason : friendlyReason }));
  return { deletedIds, failed };
}

export async function deleteQuestionsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_questions_cascade', ids, 'Bu soru öğrenci geçmişinde kullanılmış, silinemiyor');
}

export async function deleteOutcomesCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_outcomes_cascade', ids, 'Kazanım silinemedi');
}

export async function deleteSectionsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_sections_cascade', ids, 'Alt başlık silinemedi');
}

export async function deleteTopicContentsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_contents_cascade', ids, 'İçerik silinemedi');
}

export async function deleteTopicsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_topics_cascade', ids, 'Bu konuda öğrenci geçmişinde kullanılmış sorular var, silinemiyor');
}

export async function deleteUnitsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_delete_units_cascade', ids, 'Bu ünitede öğrenci geçmişinde kullanılmış sorular var, silinemiyor');
}

// Force-delete: admin toplu-sil sayfasında sadece "öğrenci geçmişini de sil" onay
// kutusu işaretlenince kullanılıyor. Normal delete* fonksiyonlarının aksine önce
// ilgili öğrenci geçmişi/AI içerik satırlarını temizleyip sonra asıl kaydı siliyor
// (bkz. supabase/migrations/admin_force_delete_cascade.sql). Geri alınamaz.
export async function forceDeleteQuestionsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_force_delete_questions_cascade', ids, 'Zorla silme başarısız', true);
}

export async function forceDeleteTopicsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_force_delete_topics_cascade', ids, 'Zorla silme başarısız', true);
}

export async function forceDeleteUnitsCascade(supabase: SupabaseClient, ids: number[]): Promise<CascadeResult> {
  return runCascadeRpc(supabase, 'admin_force_delete_units_cascade', ids, 'Zorla silme başarısız', true);
}
