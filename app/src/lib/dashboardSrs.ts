import type { SupabaseClient } from '@supabase/supabase-js';
import { SRSReview } from '@/app/src/models/types';

// user_question_stats.next_review_at bugüne veya geçmişe denk gelen sorular "tekrar zamanı
// gelmiş" sayılır (bkz. srs_adaptive_engine.sql'deki SRS motoru: doğru cevapta ease_factor'a
// göre adaptif aralık — ilk iki doğru sabit 1/6 gün, sonrası önceki aralık × ease_factor, max
// 180 gün — yanlışta 1 güne resetlenir). SRS soru bazlı bir mekanizma olduğu için hangi
// ders/ünitede olduğuna bakılmaksızın kullanıcının tüm tekrar borcu gösterilir; profildeki
// grade_id varsa sadece o sınıfla sınırlanır.
export async function getDueSrsCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null
): Promise<number> {
  let query = supabase
    .from('user_question_stats')
    .select('*, questions!inner(is_active)', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('questions.is_active', true)
    .lte('next_review_at', new Date().toISOString());
  if (profileGradeId) query = query.eq('grade_id', profileGradeId);

  const { count } = await query;
  return count ?? 0;
}

// "Şimdi Tekrar Et" akışı için gerçek soru id'lerini döner (sadece sayı değil). Sıralama
// artık salt "en eski next_review_at" değil — önce ai_help_count (öğrenci @hocam/@kanka'ya
// sormuşsa "anlamadım" sinyali en güçlüsü), sonra wrong_attempts (kronik yanlış = "leech")
// azalan, en son next_review_at artan. Böylece kronik zorlanılan bir soru, sırf tesadüfen
// daha geç due olan sıradan bir sorunun arkasında kalmıyor (bkz. SRS backlog madde 2-3,
// [[project_srs_improvement_backlog]]). Taslak (is_active=false) sorular hiç gösterilmez —
// diğer soru listeleme kodlarıyla (quizQuestions.ts) aynı kural.
export async function getDueSrsQuestionIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null,
  limit: number
): Promise<number[]> {
  let query = supabase
    .from('user_question_stats')
    .select('question_id, next_review_at, wrong_attempts, ai_help_count, questions!inner(is_active)')
    .eq('user_id', userId)
    .eq('questions.is_active', true)
    .lte('next_review_at', new Date().toISOString())
    .order('ai_help_count', { ascending: false })
    .order('wrong_attempts', { ascending: false })
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
