import type { Metadata } from 'next';
import UyeClient from './UyeClient';

// Üye profil kartı — arama motorlarına kapalı (KVKK/gizlilik), paylaşılan bağlantılarda zengin önizleme başlığı sunar.
export const metadata: Metadata = {
  title: 'Öğrenci Başarı Kartı | DersTakip',
  description: 'Çalışma serisini, haftalık soru temposunu ve kazanılan rozetleri incele; ücretsiz katılıp sıralamada yarış!',
  openGraph: {
    title: 'Öğrenci Başarı Kartı · DersTakip',
    description: 'Çalışma serisini ve kazandığı rozetleri gör, sen de yarışa katıl!',
  },
  robots: { index: false, follow: false },
};

export default async function UyePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <UyeClient slug={slug} />;
}
