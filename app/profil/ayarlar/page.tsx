import type { Metadata } from 'next';
import { Suspense } from 'react';
import AyarlarClient from './AyarlarClient';

export const metadata: Metadata = { title: 'Ayarlar', robots: { index: false } };

export default function AyarlarPage() {
  return (
    <Suspense fallback={null}>
      <AyarlarClient />
    </Suspense>
  );
}
