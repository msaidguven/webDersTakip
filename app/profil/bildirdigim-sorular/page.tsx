import type { Metadata } from 'next';
import { Suspense } from 'react';
import BildirdigimSorularClient from './BildirdigimSorularClient';

export const metadata: Metadata = { title: 'Bildirdiğim sorular', robots: { index: false } };

export default function BildirdigimSorularPage() {
  return (
    <Suspense fallback={null}>
      <BildirdigimSorularClient />
    </Suspense>
  );
}
