import Link from 'next/link';

const LEGAL_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/iletisim', label: 'İletişim' },
  { href: '/sitemap.xml', label: 'Site Haritası', external: true },
];

export function LegalFooter() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 py-2.5 sm:py-3 px-4 sm:px-8
        bg-white/80 dark:bg-surface/95
        backdrop-blur-xl
        border-t border-zinc-200 dark:border-default
        shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)] dark:shadow-none"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1.5 sm:gap-4 text-center">
        <p className="text-muted-foreground text-xs sm:text-sm font-bold order-2 sm:order-1">
          © {new Date().getFullYear()} Ders Takip. Tüm hakları saklıdır.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 order-1 sm:order-2">
          {LEGAL_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener"
                className="text-xs sm:text-sm font-bold text-muted-foreground hover:text-default transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs sm:text-sm font-bold text-muted-foreground hover:text-default transition-colors"
              >
                {link.label}
              </Link>
            )
          )}
          <Link href="/" className="text-xs sm:text-sm font-bold text-muted-foreground hover:text-default transition-colors">
            Ana Sayfa
          </Link>
        </nav>
      </div>
    </footer>
  );
}
