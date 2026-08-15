import type { Metadata } from 'next';
import Link from 'next/link';
import { StaticPageLayout } from '@/app/src/components/StaticPageLayout';

export const metadata: Metadata = {
  title: 'Sayfa Bulunamadı',
};

export default function NotFound() {
  return (
    <StaticPageLayout title="Sayfa Bulunamadı">
      <p>Aradığınız sayfa kaldırılmış, taşınmış ya da hiç var olmamış olabilir.</p>
      <p>
        <Link href="/">Ana sayfaya</Link> dönüp aradığınız sınıf veya dersi oradan bulabilirsiniz.
      </p>
    </StaticPageLayout>
  );
}
