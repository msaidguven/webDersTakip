import type { Metadata } from 'next';
import { SITE_URL } from '@/app/src/lib/site';

// Sayfa 'use client' olduğu için metadata burada. Konu/test sayfalarındaki
// "/login?redirectTo=..." linkleri her sayfa için ayrı bir URL üretiyor; bunların
// Google'da indekslenmemesi için noindex (follow açık kalır). Kök metadata'daki
// anasayfa canonical'ı da miras alınmasın diye kendi canonical'ı veriliyor.
// robots.txt ile engellenmemeli — aksi halde Google noindex'i göremez.
export const metadata: Metadata = {
  title: 'Giriş Yap',
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  alternates: { canonical: `${SITE_URL}/login` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
