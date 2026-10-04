// Girişli kullanıcının kendi profili (GET /api/profile/update) — kenar menüsü, profil uyarı bandı ve
// anasayfa her sayfa açılışında ayrı ayrı çekiyordu: öğrencinin her sayfa geçişi 1-2 Vercel
// fonksiyonu demekti (2026-10-04, Fluid Active CPU sınırı aşıldı). Artık aynı sekmede 30 dk saklanır
// ve aynı anda gelen istekler tek istekte birleşir. Profil değiştiren her PATCH'ten sonra
// clearMyProfileCache() çağrılmalı (bayat sınıf/kullanıcı adı görünmesin).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MyProfileResponse = { profile: any } & Record<string, unknown>;

const STORAGE_KEY = 'my-profile-cache-v1';
const TTL_MS = 30 * 60 * 1000;
let inflight: { userId: string; promise: Promise<MyProfileResponse | null> } | null = null;

function readStored(userId: string): MyProfileResponse | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { userId: string; at: number; data: MyProfileResponse };
    return stored.userId === userId && Date.now() - stored.at < TTL_MS ? stored.data : null;
  } catch {
    return null;
  }
}

export function fetchMyProfile(userId: string): Promise<MyProfileResponse | null> {
  const cached = readStored(userId);
  if (cached) return Promise.resolve(cached);
  if (inflight?.userId === userId) return inflight.promise;
  const promise = fetch('/api/profile/update')
    .then((res) => (res.ok ? (res.json() as Promise<MyProfileResponse>) : null))
    .then((data) => {
      if (data) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, at: Date.now(), data }));
        } catch {
          /* depolama kapalı — yalnız önbelleksiz devam */
        }
      }
      return data;
    })
    .catch(() => null)
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { userId, promise };
  return promise;
}

export function clearMyProfileCache(): void {
  inflight = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* yok say */
  }
}
