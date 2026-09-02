import type { SupabaseClient } from '@supabase/supabase-js';
import { toDateString, todayDateString } from './dashboardDate';

// Sabit bir günlük hedef: DB'de kullanıcı bazlı bir dailyGoal alanı yok (bkz.
// docs/site-iyilestirme-plani.md madde 3 tartışması), bu yüzden herkes için tek bir hedef
// kullanılıyor. İleride kişiselleştirilecekse profiles'a bir kolon eklenip buradan okunabilir.
export const DAILY_GOAL_QUESTIONS = 20;

const STREAK_LOOKBACK_DAYS = 60;

// ÖNEMLİ: Bugün/streak/lider tablosu artık user_time_based_stats (rollup) yerine DOĞRUDAN
// test_session_answers'tan hesaplanıyor. Sebebi: o rollup sadece finish_test_session
// çağrıldığında (yani kullanıcı testin SONUNA kadar gidip "sonuç" ekranını gördüğünde)
// güncelleniyor — ama QuizClient bilinçli olarak "sayfadan ayrılırsa oturumu otomatik
// bitirme" mantığı kullanıyor (kaldığı yerden devam edebilsin diye, bkz. QuizClient.tsx'teki
// 2026-09-02 tarihli not). Sonuç: bir öğrenci sorular çözüp sayfadan ayrılırsa (testi
// bitirmeden), cevapları test_session_answers'a kaydediliyor ama rollup hiç güncellenmiyor —
// streak/bugünkü soru sayısı günlerce "takılı" görünüyordu. Ham log her zaman güncel
// olduğu için buradan hesaplamak, oturumun bitip bitmediğinden bağımsız çalışır.
async function getAnswerDatesSince(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  sinceIso: string
): Promise<string[]> {
  const { data } = await supabase
    .from('test_session_answers')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceIso);

  // new Date(iso) tarayıcının yerel saat dilimine (Türkiye) göre yıl/ay/gün bileşenlerini
  // verir — todayDateString()'in de kullandığı aynı yerel-gün mantığı, sunucu tarafında
  // ayrıca bir 'Europe/Istanbul' dönüşümüne gerek kalmıyor.
  return ((data as { created_at: string }[] | null) || []).map((r) => toDateString(new Date(r.created_at)));
}

export async function getTodayQuestionCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  // Yerel gece yarısından 1 gün öncesinden çekip JS'de tam tarihe göre filtreliyoruz —
  // DB UTC sakladığı için "bugün" sınırı UTC'de biraz kayar, bu marj onu güvenle kapsar.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 1);
  const dates = await getAnswerDatesSince(supabase, userId, since.toISOString());
  const today = todayDateString();
  return dates.filter((d) => d === today).length;
}

// Duolingo tarzı: bugün henüz soru çözülmemişse streak hemen sıfırlanmaz — dünden itibaren
// ardışık aktif günler sayılır, streak "bugün bitene kadar" hayatta kalır ve kullanıcıyı bugün
// de çözmeye iter.
export async function getCurrentStreak(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - STREAK_LOOKBACK_DAYS);

  const dates = await getAnswerDatesSince(supabase, userId, since.toISOString());
  const activeDates = new Set(dates);
  if (activeDates.size === 0) return 0;

  const cursor = new Date();
  if (!activeDates.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDates.has(toDateString(cursor))) return 0;
  }

  let streak = 0;
  while (activeDates.has(toDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
