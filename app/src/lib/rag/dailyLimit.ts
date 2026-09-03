import type { SupabaseClient } from '@supabase/supabase-js';

// Sınırsız soru = sınırsız Gemini maliyeti. Öğrenci başına günlük ücretsiz hak.
// İleride reklam izleyerek ya da belli sayıda quiz sorusu çözerek bu hakkı
// artırma gibi bir mekanizma eklenebilir — o ayrı bir özellik, şimdilik sabit.
export const DAILY_QUESTION_LIMIT = 5;
// Admin hesapları deneme/test amaçlı çok daha yüksek bir günlük hakka sahip.
const ADMIN_DAILY_QUESTION_LIMIT = 100;

// Kullanıcının rolüne göre geçerli günlük soru hakkını döner (admin ise yüksek,
// öğrenciyse standart limit).
export async function getDailyLimitFor(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return (profile as { role: string | null } | null)?.role === 'admin' ? ADMIN_DAILY_QUESTION_LIMIT : DAILY_QUESTION_LIMIT;
}

const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, sabit (Türkiye 2016'dan beri yaz saati uygulamıyor)

// Türkiye saatiyle "bugünün" başlangıcını UTC ISO string olarak döner — günlük
// limit, sunucunun/istemcinin UTC saatine göre değil öğrencinin yaşadığı güne göre sıfırlansın diye.
function turkeyDayStartUtcIso(): string {
  const now = new Date();
  const turkeyNow = new Date(now.getTime() + TURKEY_OFFSET_MS);
  const turkeyMidnightAsUtc = Date.UTC(turkeyNow.getUTCFullYear(), turkeyNow.getUTCMonth(), turkeyNow.getUTCDate());
  return new Date(turkeyMidnightAsUtc - TURKEY_OFFSET_MS).toISOString();
}

// Cevaplanmış (rag_answers) + henüz kuyrukta bekleyen (rag_question_queue) soruların
// TOPLAMI sayılıyor — sorular artık senkron değil kuyruğa alınıp işlendiği için
// (bkz. /api/rag/ask, /api/rag/process-queue), sadece rag_answers'ı saymak öğrencinin
// kuyruk henüz işlenmeden limitin çok üstünde soru biriktirmesine izin verirdi.
export async function countTodayQuestions(supabase: SupabaseClient, studentId: string): Promise<number> {
  const dayStart = turkeyDayStartUtcIso();
  const [answeredResult, queuedResult] = await Promise.all([
    supabase.from('rag_answers').select('id', { count: 'exact', head: true }).eq('student_id', studentId).gte('created_at', dayStart),
    supabase.from('rag_question_queue').select('id', { count: 'exact', head: true }).eq('student_id', studentId).gte('created_at', dayStart),
  ]);
  if (answeredResult.error) throw new Error(`Günlük soru sayısı hesaplanamadı: ${answeredResult.error.message}`);
  if (queuedResult.error) throw new Error(`Günlük soru sayısı hesaplanamadı: ${queuedResult.error.message}`);
  return (answeredResult.count ?? 0) + (queuedResult.count ?? 0);
}
