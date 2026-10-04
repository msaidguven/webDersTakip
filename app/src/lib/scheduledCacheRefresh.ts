// app/src/lib/scheduledCacheRefresh.ts
// Sayfalar 7 gün önbellekte kalıyor (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı). Güne ve
// haftaya bağlı bölümler bayatlamasın diye günlük cron (vercel.json → /api/cron/srs-reminder-notify,
// her gün 06:00 UTC = 09:00 TR) bunu çağırır — Hobby planda cron sınırı 2 ve ikisi de dolu olduğu
// için ayrı bir cron açılmadı.
//  - Her gün: anasayfa (Günün Sorusu ve "YENİ" rozeti güne bağlı).
//  - Pazartesi: tüm sayfalar (müfredat haftası değişti → "Okulda bu hafta", ders/konu sayfalarındaki
//    haftalık görünüm). revalidatePath yalnız "bayat" işaretler; sayfa bir sonraki ziyarette, bir kez
//    üretilir — 7 günlük TTL'in zaten yapacağı işi haftanın başına hizalar.
import { revalidatePath } from 'next/cache';

export function runScheduledCacheRefresh(now = new Date()): { homepage: true; allPages: boolean } {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', weekday: 'short' }).format(now);
  const allPages = weekday === 'Mon';
  if (allPages) revalidatePath('/', 'layout');
  else revalidatePath('/');
  return { homepage: true, allPages };
}
