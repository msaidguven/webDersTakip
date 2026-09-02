import type { SupabaseClient } from '@supabase/supabase-js';
import { Stat } from '@/app/src/models/types';
import { toDateString, todayDateString } from './dashboardDate';

// Stats satırı "bugün" özetidir. Daha önce user_time_based_stats'ın period_type='daily'
// satırından okunuyordu — o satır sadece finish_test_session çağrıldığında (testin
// SONUNA kadar gidilip sonuç ekranı görüldüğünde) güncelleniyor. QuizClient bilinçli
// olarak "sayfadan ayrılırsa oturumu otomatik bitirme" mantığı kullandığı için (kaldığı
// yerden devam edebilsin diye) çoğu oturum hiç "bitmiyor" ve bu satır asla güncellenmiyordu
// — öğrenci soru çözmüş olsa bile panelde 0/bayat sayı görünüyordu (bkz. kullanıcıyla
// 2026-09-02 tartışması). Artık ham log olan test_session_answers'tan doğrudan hesaplanıyor,
// oturumun bitip bitmediğinden bağımsız — her cevap anında sayılır.
export async function getTodayStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  dueSrsCount: number
): Promise<Stat[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 1);

  const { data } = await supabase
    .from('test_session_answers')
    .select('created_at, is_correct, duration_seconds')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());

  const today = todayDateString();
  const todayRows = ((data as { created_at: string; is_correct: boolean; duration_seconds: number | null }[] | null) || [])
    .filter((r) => toDateString(new Date(r.created_at)) === today);

  const totalQuestions = todayRows.length;
  const correctAnswers = todayRows.filter((r) => r.is_correct).length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const minutes = Math.round(todayRows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / 60);
  const successRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return [
    { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: correctAnswers, label: 'Doğru Cevap' },
    { id: 'wrong-today', icon: 'x-circle', iconColor: 'rose', value: wrongAnswers, label: 'Yanlış Cevap' },
    { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: minutes, label: 'Dakika' },
    { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: `${successRate}%`, label: 'Başarı Oranı' },
    { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: dueSrsCount, label: 'Tekrar Gerekli' },
  ];
}

export interface OverallStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
}

// Kaldırılan /progress sayfasının "genel özeti" (bkz. kullanıcıyla 2026-09-02 tartışması) —
// artık panelin karşılama banner'ına taşındı. getProfileStats (profil sayfasının kullandığı)
// bilinçli olarak kullanılmadı: o, kapsam/ustalık gibi burada gerekmeyen ekstra sorgular da
// çalıştırıyor. Aynı tek kaynak olan test_session_answers'tan (bkz. getTodayStats'taki not)
// sadece ihtiyaç duyulan toplam/doğru/yanlış/başarı oranını hesaplar.
export async function getOverallStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<OverallStats> {
  const { data } = await supabase
    .from('test_session_answers')
    .select('is_correct')
    .eq('user_id', userId);

  const rows = (data as { is_correct: boolean }[] | null) || [];
  const totalQuestions = rows.length;
  const correctAnswers = rows.filter((r) => r.is_correct).length;
  const wrongAnswers = totalQuestions - correctAnswers;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return { totalQuestions, correctAnswers, wrongAnswers, accuracy };
}
