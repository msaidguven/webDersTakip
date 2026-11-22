import Link from 'next/link';

const LEGAL_LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: '/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/hakkimizda', label: 'Hakkımızda' },
  { href: '/iletisim', label: 'İletişim' },
  { href: '/farkli-konular', label: 'Farklı Konular' },
  { href: '/yazili-sorulari', label: 'Yazılı Soruları' },
  { href: '/ders-takip-cizelgesi', label: 'Ders Takip Çizelgesi' },
  { href: '/takdir-tesekkur-hesaplama', label: 'Takdir/Teşekkür Hesaplama' },
  { href: '/yillik-plan', label: 'Yıllık Plan' },
  { href: '/sitemap.xml', label: 'Site Haritası', external: true },
];

export function LegalFooter() {
  return (
    <footer
      className="py-2.5 sm:py-3 px-4 sm:px-8
        bg-white/80 dark:bg-surface/95
        border-t border-zinc-200 dark:border-default"
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-1.5 sm:gap-4 text-center">
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
        <p className="text-center sm:text-left text-[11px] leading-relaxed text-muted-foreground/90">
          Ders Takip bağımsız bir eğitim platformudur; T.C. Millî Eğitim Bakanlığı (MEB) veya herhangi bir devlet
          kurumuyla bağlantılı değildir. Resmi müfredat kaynakları:{' '}
          <a href="https://tymm.meb.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-default">
            tymm.meb.gov.tr
          </a>
          ,{' '}
          <a href="https://mufredat.meb.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-default">
            mufredat.meb.gov.tr
          </a>
          ,{' '}
          <a href="https://odsgm.meb.gov.tr" target="_blank" rel="noopener noreferrer" className="underline hover:text-default">
            odsgm.meb.gov.tr
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
