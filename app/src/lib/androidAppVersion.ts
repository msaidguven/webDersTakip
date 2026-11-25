// Android TWA (net.derstakip.app) sürüm kontrolü yapılandırması.
// Play Store'a yeni bir Android sürümü (versionCode) yayınladığınızda
// NEXT_PUBLIC_ANDROID_LATEST_VERSION ortam değişkenini (veya buradaki varsayılanı)
// yeni versionCode değerine yükseltmeniz yeterlidir.
//
// İsteğe bağlı: NEXT_PUBLIC_ANDROID_MIN_VERSION değerini yükseltirseniz,
// bunun altındaki sürümlerde "Kapat" düğmesi gizlenir (zorunlu güncelleme uyarısı).

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=net.derstakip.app';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LATEST_ANDROID_VERSION_CODE = parsePositiveInt(
  process.env.NEXT_PUBLIC_ANDROID_LATEST_VERSION,
  1,
);

export const MIN_ANDROID_VERSION_CODE = parsePositiveInt(
  process.env.NEXT_PUBLIC_ANDROID_MIN_VERSION,
  1,
);

const APP_VERSION_STORAGE_KEY = 'dt_android_app_version';
const DISMISSED_VERSION_STORAGE_KEY = 'dt_android_update_dismissed_for';

/**
 * Mevcut oturumun Android TWA uygulamasından gelip gelmediğini ve hangi versionCode'da
 * olduğunu saf (yan etkisiz) olarak okur.
 * - ?appVersion=2 varsa -> 2 (v2 ve sonrası)
 * - ?kaynak=uygulama var ama appVersion yoksa -> 1 (ilk Play Store sürümü)
 * - Daha önce bu oturumda kaydedildiyse -> sessionStorage'daki sürüm
 * - Normal web tarayıcısı -> null
 */
export function readAndroidAppVersion(search: string): number | null {
  try {
    const params = new URLSearchParams(search);
    const rawVersion = params.get('appVersion');
    if (rawVersion) {
      const parsed = Number.parseInt(rawVersion, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const stored = sessionStorage.getItem(APP_VERSION_STORAGE_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    if (params.get('kaynak') === 'uygulama') {
      return 1;
    }
  } catch {
    // sessionStorage kapalıysa sessizce yoksay
  }
  return null;
}

/**
 * Tespit edilen Android sürümünü sayfa geçişlerinde korunması için sessionStorage'a yazar.
 */
export function persistAndroidAppVersion(search: string): void {
  const version = readAndroidAppVersion(search);
  if (version === null) return;
  try {
    sessionStorage.setItem(APP_VERSION_STORAGE_KEY, String(version));
  } catch {
    // sessizce yoksay
  }
}

export function isUpdateDismissedFor(targetVersion: number): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_VERSION_STORAGE_KEY) === String(targetVersion);
  } catch {
    return false;
  }
}

export function dismissUpdateFor(targetVersion: number): void {
  try {
    sessionStorage.setItem(DISMISSED_VERSION_STORAGE_KEY, String(targetVersion));
  } catch {
    // sessizce yoksay
  }
}
