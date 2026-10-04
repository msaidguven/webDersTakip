// app/src/lib/publicApiCache.ts
// Herkese açık sayfalarda açılışta tarayıcıdan çağrılan, oturuma göre değişen API'ler (soru bankası
// durumu, konu tartışması akışları, RAG durumu) misafirde her ziyarette fonksiyon çalıştırıyordu
// (2026-10-04, Vercel Fluid Active CPU sınırı aşıldı: her konu sayfası açılışı 4 fonksiyon).
// Misafir yanıtı herkes için aynı olduğundan CDN'de önbelleklenir:
//  - İstemci, oturum YOKSA isteğe `public=1` ekler (withPublicFlag, ağa gitmeden çerezden okur).
//  - Sunucu yalnız `public=1` VE oturum yokken önbellek başlığı ekler (publicCacheHeaders) —
//    kişisel bir yanıt asla önbelleğe girmez; girişli kullanıcı işaretsiz URL'den canlı veri alır.

export const PUBLIC_API_CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' };

export function publicCacheHeaders(searchParams: URLSearchParams, hasUser: boolean): Record<string, string> | undefined {
  return !hasUser && searchParams.get('public') === '1' ? PUBLIC_API_CACHE_HEADERS : undefined;
}
