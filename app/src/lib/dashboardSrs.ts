import type { SupabaseClient } from '@supabase/supabase-js';
import { SRSReview } from '@/app/src/models/types';

// user_question_stats.next_review_at bugüne veya geçmişe denk gelen sorular "tekrar zamanı
// gelmiş" sayılır (bkz. fix_rebuild_user_question_stats_srs_bugs.sql'deki SRS motoru: her doğru
// cevapta streak'e göre 3-90 gün sonrasına, yanlışta 1 gün sonrasına ertelenir). SRS soru
// bazlı bir mekanizma olduğu için hangi ders/ünitede olduğuna bakılmaksızın kullanıcının tüm
// tekrar borcu gösterilir; profildeki grade_id varsa sadece o sınıfla sınırlanır.
export async function getDueSrsCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null
): Promise<number> {
  let query = supabase
    .from('user_question_stats')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString());
  if (profileGradeId) query = query.eq('grade_id', profileGradeId);

  const { count } = await query;
  return count ?? 0;
}

// "Şimdi Tekrar Et" akışı için gerçek soru id'lerini döner (sadece sayı değil) — en acil
// (en eski next_review_at) sorular önce, tek testte en fazla `limit` soru olacak şekilde.
export async function getDueSrsQuestionIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null,
  limit: number
): Promise<number[]> {
  let query = supabase
    .from('user_question_stats')
    .select('question_id, next_review_at')
    .eq('user_id', userId)
    .lte('next_review_at', new Date().toISOString())
    .order('next_review_at', { ascending: true })
    .limit(limit);
  if (profileGradeId) query = query.eq('grade_id', profileGradeId);

  const { data } = await query;
  return ((data as { question_id: number }[] | null) || []).map((r) => r.question_id);
}

export function buildSrsReview(dueCount: number): SRSReview | null {
  if (!dueCount) return null;
  return {
    id: 'srs-due',
    title: 'Zamanı Gelen Tekrarlar',
    description: `${dueCount} soru için tekrar zamanı geldi. Bu soruları çözerek öğrenmeni pekiştir.`,
    questionCount: dueCount,
    dueDate: new Date(),
  };
}
