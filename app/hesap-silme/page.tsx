import type { Metadata } from 'next';
import HesapSilmeClient from './HesapSilmeClient';

export const metadata: Metadata = { title: 'Hesabımı sil', robots: { index: false } };

export default function HesapSilmePage() {
  return <HesapSilmeClient />;
}
