// app/src/lib/scheduledCacheRefresh.ts
// Sayfalar 7 gün önbellekte (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı). Önbellek haftada bir,
// PAZARTESİ 03:00 TR'de (00:00 UTC) yenilenir (2026-10-10 kullanıcı kararı; önceden pazar 10:00): pg_cron
// (supabase/migrations/weekly_cache_refresh_cron.sql) /api/cron/weekly-cache-refresh'i çağırır, o da TÜM
// sayfaları bayat işaretler. Müfredat haftası pazartesi 00:00 TR'de değişir (routeParsing.ts →
// curriculumNow) — 03:00 yenilemesi yeni haftayı üretir. Günün Sorusu haftanın 7 sorusundan tarayıcıda
// seçildiği, "YENİ" rozeti de tarayıcıda hesaplandığı için anasayfa günlük yenilenmez. Onaylanan yorumlar
// da bu yenilemede görünür (bkz. publicApiCache.ts). Hobby planda Vercel cron sınırı 2 ve ikisi de dolu —
// bu yüzden pg_cron.
import { revalidatePath } from 'next/cache';

export function refreshAllPages(): void {
  revalidatePath('/', 'layout');
}
