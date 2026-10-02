'use client';

import { useEffect } from 'react';

// Tam ekran oynatıcılar (slayt, sesli anlatım) açıkken kök yazı boyutunu ekran boyutuna göre
// büyütür — rem ile ölçülen HER ŞEY (yazı, kutular, boşluklar, düğmeler) aynı oranda büyür.
// Akıllı tahtada (ör. 1920×1080 ya da 4K) içerik dizüstü ölçüsünde küçük kalıyordu
// (kullanıcının 2026-10-02 isteği: "üst sınır koyma, her şey orantılı büyüsün").
//
// - Oran: referans ekrana (1280×720) göre genişlik/yükseklik oranlarının KÜÇÜĞÜ — içerik ekrandan
//   taşmaz. 1'in altına inmez: telefon/dizüstünde hiçbir şey değişmez. Üst sınır yok.
// - Kullanıcının tarayıcı varsayılan yazı boyutu (erişilebilirlik) korunur: taban, açılıştaki
//   hesaplanmış kök boyutu.
// - Oynatıcı kapanınca kök boyut eski hâline döner. Oynatıcı tam ekranı kapladığı için arkadaki
//   sayfanın geçici olarak büyümesi görünmez.
const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;

export function viewportScaleFactor(width: number, height: number): number {
  return Math.max(1, Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT));
}

export function useViewportRemScale(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const previousInline = root.style.fontSize;
    const basePx = parseFloat(getComputedStyle(root).fontSize) || 16;

    const apply = () => {
      const factor = viewportScaleFactor(window.innerWidth, window.innerHeight);
      root.style.fontSize = factor === 1 ? previousInline : `${basePx * factor}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    document.addEventListener('fullscreenchange', apply);
    return () => {
      window.removeEventListener('resize', apply);
      document.removeEventListener('fullscreenchange', apply);
      root.style.fontSize = previousInline;
    };
  }, [enabled]);
}
