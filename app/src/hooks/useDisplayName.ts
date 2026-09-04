'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type ProfileNameRow = { full_name: string | null; username: string | null };

// Header'daki profil menüsü "👋 {mailin ilk kısmı}" gösteriyordu çünkü auth
// user'ın email'i dışında bir şeyi yoktu — kullanıcı bildirimi (2026-09-04).
// Gerçek ad profiles tablosunda; bir selamlama için @username yerine gerçek
// ismi (full_name) öncelikli gösteriyoruz, o yoksa username'e düşüyoruz.
export function useDisplayName(): string | null {
  const { user, supabase } = useAuth();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setName(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: ProfileNameRow | null }) => {
        if (!cancelled) setName(data?.full_name || data?.username || null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, supabase]);

  return name;
}
