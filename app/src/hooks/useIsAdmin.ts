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

// Hesabın gerçek rolü (görünüm seçiminden bağımsız) — rol menüsünü kimin göreceği gibi kararlar için.
export function useRealProfileRole(): string | null {
  const { realUser: user, supabase } = useAuth();
  // Rol, okunduğu kullanıcıyla birlikte tutulur: çıkış/hesap değişince eski rol hemen geçersiz sayılır.
  const [state, setState] = useState<{ userId: string; role: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: ProfileRoleRow | null }) => {
        if (!cancelled) setState({ userId: user.id, role: data?.role ?? null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  return user && state?.userId === user.id ? state.role : null;
}
