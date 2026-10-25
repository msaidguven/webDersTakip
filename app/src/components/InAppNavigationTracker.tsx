'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Bu sekmede site içi (istemci tarafı) kaç farklı sayfa görüldü — tam sayfa yüklemesinde sıfırlanır.
// Ayrı test sayfaları (kavrama/ünite/sıralı test, tekrar) kapatılınca öğrenciyi geldiği yere
// döndürebilsin diye (2026-10-23): site içinden gelindiyse router.back(), doğrudan açıldıysa
// (yeni sekme, bildirim) geri gidecek site sayfası yok → sabit çıkış adresi.
let lastPathname: string | null = null;
let pageViews = 0;

export function hasInAppHistory(): boolean {
  return pageViews > 1;
}

export function InAppNavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    // Aynı yol için iki kez saymasın (geliştirmede efektler çift çalışır).
    if (pathname === lastPathname) return;
    lastPathname = pathname;
    pageViews += 1;
  }, [pathname]);
  return null;
}
