'use client';

// Soru bankası mobil hızlı geçiş şeridi (2026-10-31, kullanıcı isteği: "her tıklamada aşağı inmek zorunda kalıyoruz").
// Başlığın hemen altında yatay kaydırılan kısa liste (ders sayfasında sınıfın dersleri, ünitede dersin üniteleri,
// konuda ünitenin konuları); bulunulan öğe vurgulu ve şeritte ortalanır. Masaüstünde yan sütundaki
// SoruBankasiNavList aynı işi görüyor, şerit yalnız lg altında.
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import r from '@/app/src/components/robotic/robotic.module.css';

export type QuickNavItem = { key: string | number; href: string; label: string; current?: boolean };

export function SoruBankasiQuickNav({ label, items }: { label: string; items: QuickNavItem[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && current) list.scrollLeft = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2;
  }, []);

  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="mt-4 lg:hidden">
      <p className={`mb-2 ${r.label}`}>{label}</p>
      <ul ref={listRef} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((item) => (
          <li key={item.key} className="shrink-0 snap-start">
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={`inline-flex min-h-10 max-w-[15rem] items-center rounded-full px-3.5 text-sm font-semibold ${item.current ? `${r.btnNeon} ${r.btnText}` : `${r.item} text-default`}`}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
