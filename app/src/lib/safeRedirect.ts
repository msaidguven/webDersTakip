// Giriş/profil sonrası "?redirectTo=" / "?next=" hedefini güvenli hale getirir — açık yönlendirme
// (open redirect) önlemi: saldırgan "/login?redirectTo=https://sahte-site" linkiyle öğrenciyi
// girişten sonra sahte bir sayfaya gönderemesin. Sadece AYNI site içi göreli yollar geçer;
// "//evil.com" ve tarayıcıların "//" gibi yorumladığı "/\evil.com" da dahil her şey reddedilir.
const BASE = 'http://site.invalid';

export function safeRedirectPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Kontrol karakterleri (sekme/yeni satır) bazı tarayıcılarda yolu kırpıp host'a çeviriyor.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
