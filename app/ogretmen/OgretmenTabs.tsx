import Link from 'next/link';

// Öğretmen paneli sekmeleri (2026-10-22): yazılı kağıdı hazırlama + mevcut konu bazlı soru seçimi.
const TABS = [
  { href: '/ogretmen/yazili', label: 'Yazılı hazırla' },
  { href: '/ogretmen', label: 'Konudan soru seç' },
] as const;

export function OgretmenTabs({ active }: { active: (typeof TABS)[number]['href'] }) {
  return (
    <nav aria-label="Öğretmen paneli" className="inline-flex gap-1 rounded-xl border border-default bg-surface p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? 'page' : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            t.href === active ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:text-default'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
