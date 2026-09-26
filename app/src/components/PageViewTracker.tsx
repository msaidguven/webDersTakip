'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

// Giriş yapmış kullanıcının gezdiği sayfaları kaydeder (admin → Üyeler → Düzenle'de
// görünür; bkz. supabase/migrations/user_page_views_tracking.sql). Sadece path
// gönderilir — query string token/arama metni içerebileceği için bilerek dışarıda.
// 1.5 sn gecikme: /ders?... → pretty-URL replaceState'i ve anlık redirect'ler ara
// adımları kaydetmesin, sadece kullanıcının gerçekten durduğu sayfa yazılsın.
const SETTLE_MS = 1500;

export function PageViewTracker() {
  const pathname = usePathname();
  const { user, supabase } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !pathname || pathname.startsWith('/admin')) return;
    const timer = window.setTimeout(() => {
      supabase.rpc('track_page_view', { p_path: pathname.slice(0, 500) }).then(({ error }) => {
        if (error && process.env.NODE_ENV !== 'production') console.warn('track_page_view:', error.message);
      });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [pathname, userId, supabase]);

  return null;
}
