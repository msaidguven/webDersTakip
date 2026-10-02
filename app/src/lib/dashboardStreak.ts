import type { SupabaseClient } from '@supabase/supabase-js';
import { toDateString, todayDateString } from './dashboardDate';

// Günlük hedef öğrencinin seçimi: profiles.daily_goal — 5–100 arası, 5'er adım (2026-10-02,
// önceden yalnız 10/20/40; bkz. profiles_daily_goal_flexible.sql). DAILY_GOAL_QUESTIONS varsayılan —
// profil okunamazsa/geçersiz değerde kullanılır. Sınırlar DB kısıtı ve set_my_daily_goal ile AYNI.
export const DAILY_GOAL_QUESTIONS = 20;
export const DAILY_GOAL_MIN = 5;
export const DAILY_GOAL_MAX = 100;
export const DAILY_GOAL_STEP = 5;
// Seçicideki hızlı seçimler.
export const DAILY_GOAL_PRESETS = [10, 20, 30, 50, 100] as const;
export type DailyGoal = number;

export function isValidDailyGoal(value: unknown): value is DailyGoal {
  return typeof value === 'number' && Number.isInteger(value) && value >= DAILY_GOAL_MIN && value <= DAILY_GOAL_MAX && value % DAILY_GOAL_STEP === 0;
}

export function parseDailyGoal(value: unknown): DailyGoal {
  return isValidDailyGoal(value) ? value : DAILY_GOAL_QUESTIONS;
}

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

// Haftalık İlerleme kartındaki gün kutucukları eskiden hardcoded'di (ilk 5 gün her zaman
// "tamamlandı" gösteriliyordu, bkz. kullanıcıyla 2026-09-02 tartışması) — burada bu haftanın
// (Pazartesi'den bugüne) her günü için gerçekten soru çözülüp çözülmediğini döndürüyoruz.
// Dizi her zaman 7 eleman: index 0=Pazartesi ... 6=Pazar.
export async function getWeeklyActiveDays(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<boolean[]> {
  const now = new Date();
  const day = now.getDay(); // 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  // UTC kayması için bir gün marj bırakıp tam eşleşmeyi toDateString ile yapıyoruz —
  // getTodayQuestionCount'taki aynı desen.
  const since = new Date(monday);
  since.setDate(since.getDate() - 1);

  const dates = await getAnswerDatesSince(supabase, userId, since.toISOString());
  const activeDates = new Set(dates);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return activeDates.has(toDateString(d));
  });
}
