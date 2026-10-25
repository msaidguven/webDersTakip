import type { Metadata } from 'next';
import UyeClient from './UyeClient';

// Üye profil kartı — yalnız giriş yapmış üyelere, arama motorlarına kapalı.
export const metadata: Metadata = { title: 'Üye profili', robots: { index: false, follow: false } };

export default async function UyePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <UyeClient slug={slug} />;
}
