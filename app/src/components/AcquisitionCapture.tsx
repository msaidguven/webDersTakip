'use client';

import { useEffect } from 'react';
import { ACQUISITION_COOKIE, ACQUISITION_COOKIE_MAX_AGE, buildAcquisition } from '../lib/acquisition';

// Ziyaretçinin ilk temas bilgisini (bkz. lib/acquisition.ts) bir kez çereze yazar. Çerez zaten varsa
// dokunmaz: ilk ziyaret kaydı korunur. Sunucu yüküne etkisi yok; kayıt route'u bu çerezi okur.
export function AcquisitionCapture() {
  useEffect(() => {
    try {
      if (document.cookie.split('; ').some((c) => c.startsWith(`${ACQUISITION_COOKIE}=`))) return;
      const value = buildAcquisition({
        pathname: location.pathname,
        search: location.search,
        host: location.host,
        referrer: document.referrer,
        width: window.innerWidth,
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      });
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${ACQUISITION_COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${ACQUISITION_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    } catch {
      // Çerez engelliyse kayıt kaynağı sessizce boş kalır; sayfa etkilenmez.
    }
  }, []);
  return null;
}
