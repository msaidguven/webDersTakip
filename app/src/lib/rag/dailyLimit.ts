import type { SupabaseClient } from '@supabase/supabase-js';

// Sınırsız soru = sınırsız Gemini maliyeti. Öğrenci başına günlük ücretsiz hak.
// İleride reklam izleyerek ya da belli sayıda quiz sorusu çözerek bu hakkı
// artırma gibi bir mekanizma eklenebilir — o ayrı bir özellik, şimdilik sabit.
export const DAILY_QUESTION_LIMIT = 5;

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, sabit (Türkiye 2016'dan beri yaz saati uygulamıyor)

// Türkiye saatiyle "bugünün" başlangıcını UTC ISO string olarak döner — günlük
// limit, sunucunun/istemcinin UTC saatine göre değil öğrencinin yaşadığı güne göre sıfırlansın diye.
function turkeyDayStartUtcIso(): string {
  const now = new Date();
  const turkeyNow = new Date(now.getTime() + TURKEY_OFFSET_MS);
  const turkeyMidnightAsUtc = Date.UTC(turkeyNow.getUTCFullYear(), turkeyNow.getUTCMonth(), turkeyNow.getUTCDate());
  return new Date(turkeyMidnightAsUtc - TURKEY_OFFSET_MS).toISOString();
}

export async function countTodayQuestions(supabase: SupabaseClient, studentId: string): Promise<number> {
  const { count, error } = await supabase
    .from('rag_answers')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .gte('created_at', turkeyDayStartUtcIso());
  if (error) throw new Error(`Günlük soru sayısı hesaplanamadı: ${error.message}`);
  return count ?? 0;
}
