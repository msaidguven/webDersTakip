'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type ProfileRoleRow = { role: string | null };

// Soru sayfasındaki admin-only "Düzenle"/"Sil" butonları için — asıl yetki kontrolü
// zaten sunucu tarafında requireAdmin() ile yapılıyor (bkz. /api/admin/manage/questions),
// bu hook sadece butonları göster/gizle amaçlı, DersClient.tsx'teki aynı deseni tekrarlar.
export function useIsAdmin(): boolean {
  return useProfileRole() === 'admin';
}

// Görünen rol: profiles.role ('admin' | 'teacher' | 'student' …), admin "şu rolde gör" seçtiyse o rol
// (misafirde null; bkz. lib/viewAs.ts) — yalnız göster/gizle için (header'daki "Öğretmen Paneli" gibi).
// Oturum yoksa null.
export function useProfileRole(): string | null {
  const real = useRealProfileRole();
  const { viewAs } = useAuth();
  if (real === 'admin' && viewAs) return viewAs === 'guest' ? null : viewAs;
  return real;
}

// Oturum içi rol önbelleği (bellek + sessionStorage): sayfa geçişlerinde ve yenilemelerde
// rol yeniden çekilene kadar yanlış rolün (ör. öğretmene öğrenci arayüzünün) yanıp sönmesini önler.
const roleCache = new Map<string, string | null>();
const ROLE_STORAGE_PREFIX = 'dt-role-cache:';

function readCachedRole(userId: string): string | null | undefined {
  if (roleCache.has(userId)) return roleCache.get(userId);
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(`${ROLE_STORAGE_PREFIX}${userId}`);
    if (raw === null) return undefined;
    const parsed = raw === '' ? null : raw;
    roleCache.set(userId, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCachedRole(userId: string, role: string | null) {
  roleCache.set(userId, role);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${ROLE_STORAGE_PREFIX}${userId}`, role ?? '');
  } catch {
    // gizli pencere / depolama kapalı
  }
}

// Hesabın gerçek rolü (görünüm seçiminden bağımsız) — rol menüsünü kimin göreceği gibi kararlar için.
export function useRealProfileRole(): string | null {
  const { realUser: user, supabase } = useAuth();
  const cached = user ? readCachedRole(user.id) : undefined;
  // Rol, okunduğu kullanıcıyla birlikte tutulur: çıkış/hesap değişince eski rol hemen geçersiz sayılır.
  const [state, setState] = useState<{ userId: string; role: string | null } | null>(() =>
    user && cached !== undefined ? { userId: user.id, role: cached } : null
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: ProfileRoleRow | null }) => {
        const nextRole = data?.role ?? null;
        writeCachedRole(user.id, nextRole);
        if (!cancelled) setState({ userId: user.id, role: nextRole });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  if (!user) return null;
  if (state?.userId === user.id) return state.role;
  return cached !== undefined ? cached : null;
}
