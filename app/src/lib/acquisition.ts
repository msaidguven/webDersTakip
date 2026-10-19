// Üyenin kayıttan önceki ilk temas bilgisi: ilk açılan sayfa, geldiği yer, cihaz, UTM.
// Tarayıcı ilk ziyarette ACQUISITION_COOKIE çerezine yazar (AcquisitionCapture); kayıt route'u ve
// OAuth callback'i çerezi okuyup profile tek seferlik yazar. Ham user-agent saklanmaz: cihaz yalnız
// mobile / tablet / desktop olarak sınıflanır. Çerez istemciden geldiği için her alan burada doğrulanır.
export const ACQUISITION_COOKIE = 'dt_acq';
export const ACQUISITION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export type Acquisition = {
  landing_path: string | null;
  referrer_host: string | null;
  referrer_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device_type: DeviceType | null;
  captured_at: string;
};

const MAX_TEXT = 300;

function clean(value: unknown, max = MAX_TEXT): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

// Tarayıcıda, ilk ziyaret anında çağrılır. Sorgu dizesinin tamamı değil yalnız utm_* alanları alınır
// (diğer parametreler token ya da arama metni taşıyabilir).
export function buildAcquisition(input: {
  pathname: string;
  search: string;
  host: string;
  referrer: string;
  width: number;
  coarsePointer: boolean;
}): Acquisition {
  const params = new URLSearchParams(input.search);
  let referrerHost: string | null = null;
  let referrerPath: string | null = null;
  if (input.referrer) {
    try {
      const url = new URL(input.referrer);
      if (url.host === input.host) referrerPath = url.pathname.slice(0, MAX_TEXT);
      else referrerHost = url.host.slice(0, 200);
    } catch {
      // Geçersiz referrer: kaynak bilinmiyor olarak kalır.
    }
  }
  const deviceType: DeviceType = input.width < 768 ? 'mobile' : input.width < 1024 && input.coarsePointer ? 'tablet' : 'desktop';
  return {
    landing_path: clean(input.pathname),
    referrer_host: referrerHost,
    referrer_path: referrerPath,
    utm_source: clean(params.get('utm_source'), 100),
    utm_medium: clean(params.get('utm_medium'), 100),
    utm_campaign: clean(params.get('utm_campaign'), 100),
    device_type: deviceType,
    captured_at: new Date().toISOString(),
  };
}

// Çerez değeri (URL-kodlu JSON) → doğrulanmış kayıt bilgisi; geçersizse null.
export function parseAcquisition(raw: string | null | undefined): Acquisition | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const capturedAt = clean(d.captured_at, 40);
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) return null;
  return {
    landing_path: clean(d.landing_path),
    referrer_host: clean(d.referrer_host, 200),
    referrer_path: clean(d.referrer_path),
    utm_source: clean(d.utm_source, 100),
    utm_medium: clean(d.utm_medium, 100),
    utm_campaign: clean(d.utm_campaign, 100),
    device_type: DEVICE_TYPES.find((t) => t === d.device_type) ?? null,
    captured_at: capturedAt,
  };
}
