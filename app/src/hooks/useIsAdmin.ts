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

// profiles.role ('admin' | 'teacher' | 'student' …) — yalnız göster/gizle için (header'daki
// "Öğretmen Paneli" bağlantısı gibi). Oturum yoksa null.
export function useProfileRole(): string | null {
  const { user, supabase } = useAuth();
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
