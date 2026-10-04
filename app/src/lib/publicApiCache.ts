// app/src/lib/publicApiCache.ts
// Herkese açık sayfalarda açılışta tarayıcıdan çağrılan, oturuma göre değişen API'ler (soru bankası
// durumu, konu tartışması akışları, RAG durumu) misafirde her ziyarette fonksiyon çalıştırıyordu
// (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı: her konu sayfası açılışı 4 fonksiyon).
// Misafir yanıtı herkes için aynı olduğundan CDN'de önbelleklenir:
//  - İstemci, oturum YOKSA isteğe `public=1` ekler (withPublicFlag, ağa gitmeden çerezden okur).
//  - Sunucu yalnız `public=1` VE oturum yokken önbellek başlığı ekler (publicCacheHeaders) —
//    kişisel bir yanıt asla önbelleğe girmez; girişli kullanıcı işaretsiz URL'den canlı veri alır.
//  - Yorum/AI akışları (comments/feed, rag/unit-feed) `public=1` gelince oturuma HİÇ bakmaz ve
//    yalnız yayındaki kayıtları döndürür; istemci bunları girişli kullanıcı için de bu şekilde
//    çağırır, kendi onay bekleyen yorumunu yerelde tutar (pendingCommentsStore.ts).
//
// Süre (2026-10-04, CPU 2. tur): sabit değil, bir sonraki PAZAR 10:00 TR'ye (07:00 UTC) kadar —
// sayfaların haftalık yenilendiği an (bkz. scheduledCacheRefresh.ts). Böylece hafta içinde
// onaylanan yorum herkese pazar sabahı, sayfalarla birlikte görünür. Haftalık mantığa dönmek
// istenirse (ör. 1 gün) yalnız nextPublicRefreshSeconds değiştirilir.

const REFRESH_UTC_DAY = 0; // pazar
const REFRESH_UTC_HOUR = 7; // 10:00 Europe/Istanbul (UTC+3, yaz saati yok)
const MIN_TTL_SECONDS = 300;

export function nextPublicRefreshSeconds(now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(REFRESH_UTC_HOUR, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((REFRESH_UTC_DAY - next.getUTCDay() + 7) % 7));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return Math.max(MIN_TTL_SECONDS, Math.floor((next.getTime() - now.getTime()) / 1000));
}

export function publicApiCacheHeaders(): Record<string, string> {
  // stale-while-revalidate kısa: süre dolduktan sonra en fazla bir istek eski yanıtı görür.
  return { 'Cache-Control': `public, s-maxage=${nextPublicRefreshSeconds()}, stale-while-revalidate=3600` };
}

export function isPublicRequest(searchParams: URLSearchParams): boolean {
  return searchParams.get('public') === '1';
}

export function publicCacheHeaders(searchParams: URLSearchParams, hasUser: boolean): Record<string, string> | undefined {
  return !hasUser && isPublicRequest(searchParams) ? publicApiCacheHeaders() : undefined;
}
