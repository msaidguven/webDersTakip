// app/src/lib/scheduledCacheRefresh.ts
// Sayfalar 7 gün önbellekte (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı — geçici, kullanıcı
// haftalık değerlendirip 1 gün/1 saate geri almayı düşünüyor). Önbellek PAZARDAN PAZARA yenilenir:
// günlük cron (vercel.json → /api/cron/srs-reminder-notify, 07:00 UTC = 10:00 TR) bunu çağırır, yalnız
// pazar günü TÜM sayfaları bayat işaretler. Yeni müfredat haftası pazar 09:00 TR'den itibaren
// hesaplanır (routeParsing.ts → curriculumNow) — 10:00 yenilemesi yeni haftayı üretir. Günün Sorusu
// haftanın 7 sorusundan tarayıcıda seçildiği, "YENİ" rozeti de tarayıcıda hesaplandığı için anasayfa
// günlük yenilenmez. Onaylanan yorumlar da bu pazar yenilemesinde görünür (bkz. publicApiCache.ts).
// Hobby planda cron sınırı 2 ve ikisi de dolu — ayrı cron açılmadı.
import { revalidatePath } from 'next/cache';

export function runScheduledCacheRefresh(now = new Date()): { allPages: boolean } {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(now);
  const allPages = weekday === 'Sun';
  if (allPages) revalidatePath('/', 'layout');
  return { allPages };
}
