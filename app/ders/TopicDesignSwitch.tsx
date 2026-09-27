'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import DersClient, { type DersClientProps } from './DersClient';
import { isTopicPageDesign, type TopicPageDesign } from '@/app/src/lib/topicPageDesign';

// Yayındaki tasarım (publishedDesign) sunucuda site_settings'ten okunup render edilir — SEO ve
// ISR önbelleği korunur. Değiştirme: Admin → Ayarlar (/admin/ayarlar); kaydedilince tüm konu
// sayfaları revalidate edilir, herkes yeni tasarımı görür (kullanıcının 2026-09-27 isteği).
// ?tasarim=v1|v2 sadece o sayfa görüntülemesi için önizlemedir (kalıcı değil).
const DersClientV2 = dynamic(() => import('./v2/DersClientV2'));
// Eski sürümde önizleme tarayıcıda kalıcı tutuluyordu; artık yayındaki ayar esas.
const LEGACY_PREVIEW_KEY = 'topic-page-design-preview';

type Props = DersClientProps & { publishedDesign: TopicPageDesign };

export default function TopicDesignSwitch({ publishedDesign, ...props }: Props) {
  const [preview, setPreview] = useState<TopicPageDesign | null>(null);

  useEffect(() => {
    try { localStorage.removeItem(LEGACY_PREVIEW_KEY); } catch { /* depolama kapalı olabilir */ }
    const fromUrl = new URLSearchParams(window.location.search).get('tasarim');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL'den tek seferlik okuma (ISR'ı bozmamak için client'ta)
    if (isTopicPageDesign(fromUrl)) setPreview(fromUrl);
  }, []);

  return (preview ?? publishedDesign) === 'v2' ? <DersClientV2 {...props} /> : <DersClient {...props} />;
}
