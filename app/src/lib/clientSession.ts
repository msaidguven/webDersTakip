// Tarayıcıda oturum var mı — ağa gitmeden (Supabase oturumu çerezden okunur). Yalnız "misafir mi?"
// ayrımı için (bkz. publicApiCache.ts); yetki kararı için KULLANILMAZ, o her zaman sunucuda verilir.
import { createClient } from '@/utils/supabase/client';
import { fetchMyProfile } from './myProfileClient';

export async function hasClientSession(): Promise<boolean> {
  try {
    const { data } = await createClient().auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

// Misafirse URL'ye public=1 ekler → yanıt CDN'den gelir (bkz. publicApiCache.ts).
export async function withPublicFlag(url: string): Promise<string> {
  return (await hasClientSession()) ? url : `${url}${url.includes('?') ? '&' : '?'}public=1`;
}

// Girişli kullanıcı admin mi — profil zaten sekmede 30 dk saklandığı için çoğu zaman ağa gitmez.
// Yalnız "taslakları da isteyeyim mi?" ayrımı için; yetki her zaman sunucuda doğrulanır.
export async function isClientAdmin(): Promise<boolean> {
  try {
    const { data } = await createClient().auth.getSession();
    if (!data.session) return false;
    return (await fetchMyProfile(data.session.user.id))?.profile?.role === 'admin';
  } catch {
    return false;
  }
}
