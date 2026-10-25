// Sınıf düzeyindeki sayfaların başlık kartında sınıf kutuları (2026-10-23): sınıf sayfası (/5-sinif)
// ve soru bankası sınıf sayfası (/soru-bankasi/5-sinif). Her kutu o sınıfın aynı türdeki sayfasına
// giden bağlantı; seçili sınıf dolgulu neon (ana düğme stili), diğerleri çerçeveli kutu.
import Link from 'next/link';
import r from './robotic/robotic.module.css';

export type GradeSwitcherItem = { level: number; href: string; current: boolean };

export function GradeSwitcher({ items }: { items: GradeSwitcherItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="Sınıf değiştir" className="grid w-full grid-cols-4 gap-2 sm:gap-3 md:w-auto md:min-w-[340px]">
      {items.map((g) => (
        <Link
          key={g.href}
          href={g.href}
          aria-current={g.current ? 'page' : undefined}
          aria-label={`${g.level}. Sınıf`}
          className={`flex flex-col items-center gap-1 px-2 py-3 transition-colors ${g.current ? `rounded-xl ${r.btnNeon}` : `${r.stat} hover:border-cyan-500/60`}`}
        >
          {/* HTML metni "6. Sınıf" olsun (arama motoru bağlantı metni): nokta ve boşluk görünmez ama metinde
              var — iki satır yan yana "6Sınıf" okunuyordu. Ekran okuyucu adı aria-label'dan (tarayıcı gizli
              noktayı ayrı parça sayıp "6 . Sınıf" diyordu). */}
          <span className={`text-2xl leading-none ${r.statValue} ${g.current ? '!text-white' : ''}`}>{g.level}<span className="sr-only">.</span></span>{' '}
          <span className={`${r.mono} text-[10.5px] font-semibold uppercase tracking-[0.14em] ${g.current ? 'text-white/90' : r.muted}`}>Sınıf</span>
        </Link>
      ))}
    </nav>
  );
}
