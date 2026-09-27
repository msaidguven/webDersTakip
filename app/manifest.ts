import type { MetadataRoute } from 'next';

// Uygulama manifesti (2026-09-27): "Ana ekrana ekle" ve iPhone'da bildirim alabilmek için şart
// (iOS'ta Web Push sadece ana ekrana eklenmiş sitede çalışır, iOS 16.4+).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ders Takip',
    short_name: 'Ders Takip',
    description: 'MEB müfredatına uygun konu anlatımları, cevap anahtarlı soru bankası ve kişisel testler.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4338CA',
    lang: 'tr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
