// app/ilerlemem/layout.tsx (eski adı /panel, 2026-09-28)
// İlerlemem altındaki tüm sayfalarda (page.tsx, aktiviteler, siralama) ortak. Eskiden `modal`
// slotu panelden açılan testleri gösteriyordu; testler artık yalnız soru bankasında (2026-10-24).
// AuthProvider/MainLayout zaten kök layout'ta (app/layout.tsx) sağlandığı için burada
// tekrarlanmıyor.
import type { Metadata } from 'next';

// Kişisel sayfa — arama motorunda yeri yok (robots.ts'te de disallow).
export const metadata: Metadata = { title: 'İlerlemem', robots: { index: false, follow: false } };

export default function IlerlememLayout({ children }: { children: React.ReactNode }) {
  return children;
}
