import type { Metadata } from 'next';
import { SITE_URL } from '@/app/src/lib/site';

// Sayfa 'use client' olduğu için metadata burada; hesap sayfası, aranmaz (bkz. login/layout.tsx).
export const metadata: Metadata = {
  title: 'Şifremi Unuttum',
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  alternates: { canonical: `${SITE_URL}/sifremi-unuttum` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
