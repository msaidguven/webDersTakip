'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type ProfileRoleRow = { role: string | null };

// Soru sayfasındaki admin-only "Düzenle"/"Sil" butonları için — asıl yetki kontrolü
// zaten sunucu tarafında requireAdmin() ile yapılıyor (bkz. /api/admin/manage/questions),
// bu hook sadece butonları göster/gizle amaçlı, DersClient.tsx'teki aynı deseni tekrarlar.
export function useIsAdmin(): boolean {
  const { user, supabase } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: ProfileRoleRow | null }) => {
        if (!cancelled) setIsAdmin(data?.role === 'admin');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  return isAdmin;
}
