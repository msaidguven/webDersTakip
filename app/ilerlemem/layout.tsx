// app/ilerlemem/layout.tsx (eski adı /panel, 2026-09-28)
// İlerlemem altındaki tüm sayfalarda (page.tsx, aktiviteler, siralama) ortak: `modal` slotu
// panelden bir teste tıklandığında intercepting route ile dolduruluyor (bkz. app/ilerlemem/@modal).
// AuthProvider/MainLayout zaten kök layout'ta (app/layout.tsx) sağlandığı için burada
// tekrarlanmıyor.
import type { Metadata } from 'next';

// Kişisel sayfa — arama motorunda yeri yok (robots.ts'te de disallow).
export const metadata: Metadata = { title: 'İlerlemem', robots: { index: false, follow: false } };

export default function IlerlememLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
