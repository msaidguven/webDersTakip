'use client';

// Okuma ilerleme çizgisi (2026-10-04, kullanıcı isteği): konu anlatımı ve soru bankası gibi uzun
// sayfalarda, sabit üst menünün hemen altında sayfanın ne kadarının okunduğunu gösteren ince
// çizgi. React state yok — kaydırmada yalnız transform güncellenir (rAF ile, yeniden render yok).
// Yalnız görsel; ekran okuyucudan gizli (sayfa kaydırma konumu zaten erişilebilir).
import { useEffect, useRef } from 'react';

export default function ReadingProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = barRef.current;
      if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${ratio})`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // İçerik sonradan uzayabiliyor ("Sonraki 10 soru", görseller) — oran ona göre düzelsin.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[60px] z-50 h-[3px] sm:top-[72px]">
      <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-indigo-500 to-violet-500" style={{ transform: 'scaleX(0)' }} />
    </div>
  );
}
