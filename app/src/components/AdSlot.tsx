'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

interface AdSlotProps {
  /** AdSense reklam birimi slot ID'si (AdSense panelinden alınır) */
  slot: string;
  className?: string;
  format?: string;
}

// Tek bir AdSense reklam alanı. NEXT_PUBLIC_ADSENSE_CLIENT_ID tanımlı değilse
// (henüz onaylı bir AdSense hesabı yoksa) hiçbir şey render etmez.
//
// Next.js'te client-side sayfa geçişlerinde <ins> DOM node'u sıfırdan oluşmadığı
// sürece adsbygoogle.push() ikinci kez çağrıldığında hata verir; bunu önlemek için
// <ins>'e pathname'e bağlı bir key veriyoruz, böylece her rota değişiminde element
// yeniden monte olur ve push() güvenle tekrar çağrılabilir.
export default function AdSlot({ slot, className = '', format = 'auto' }: AdSlotProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // AdSense script'i henüz yüklenmemiş olabilir (adblock, yavaş ağ); sessizce geç
    }
  }, [pathname]);

  if (!ADSENSE_CLIENT) return null;

  return (
    <div className={`w-full flex flex-col items-center gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">Reklam</span>
      <ins
        key={pathname}
        className="adsbygoogle block w-full"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
