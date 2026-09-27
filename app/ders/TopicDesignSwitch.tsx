'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import DersClient, { type DersClientProps } from './DersClient';
import { TOPIC_PAGE_DESIGN, type TopicPageDesign } from '@/app/src/lib/topicPageDesign';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';

// Varsayılan tasarım (TOPIC_PAGE_DESIGN) sunucuda render edilir — SEO ve ISR önbelleği
// değişmez. Önizleme seçimi sunucuda okunmuyor (okunsaydı sayfa ISR'dan çıkardı); mount
// sonrası client'ta uygulanır:
//   * ?tasarim=v1|v2 parametresi (paylaşılabilir önizleme linki), ya da
//   * admin'e görünen köşedeki v1/v2 düğmesi — seçim bu tarayıcıda hatırlanır, konudan
//     konuya geçince de korunur (kullanıcının 2026-09-27 bildirimi: parametre gezinirken
//     kayboluyordu, v2 görünmüyordu).
const DersClientV2 = dynamic(() => import('./v2/DersClientV2'));
const STORAGE_KEY = 'topic-page-design-preview';

function isDesign(value: string | null): value is TopicPageDesign {
  return value === 'v1' || value === 'v2';
}

function readPreference(): TopicPageDesign | null {
  const fromUrl = new URLSearchParams(window.location.search).get('tasarim');
  if (isDesign(fromUrl)) {
    try { localStorage.setItem(STORAGE_KEY, fromUrl); } catch { /* depolama kapalı olabilir */ }
    return fromUrl;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDesign(stored) ? stored : null;
  } catch {
    return null;
  }
}

export default function TopicDesignSwitch(props: DersClientProps) {
  const isAdmin = useIsAdmin();
  const [design, setDesign] = useState<TopicPageDesign>(TOPIC_PAGE_DESIGN);

  useEffect(() => {
    const preferred = readPreference();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcıya özel tercih, ISR'ı bozmamak için client'ta okunuyor
    if (preferred) setDesign(preferred);
  }, []);

  function choose(next: TopicPageDesign) {
    setDesign(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* depolama kapalı olabilir */ }
  }

  return (
    <>
      {design === 'v2' ? <DersClientV2 {...props} /> : <DersClient {...props} />}
      {isAdmin && (
        <div
          role="group"
          aria-label="Konu sayfası tasarımı"
          className="fixed bottom-24 left-3 z-[60] flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 text-xs font-bold shadow-lg backdrop-blur sm:bottom-4"
        >
          <span className="px-2 text-slate-500">Tasarım</span>
          {(['v1', 'v2'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => choose(d)}
              aria-pressed={design === d}
              className={`rounded-full px-3 py-1.5 transition-colors ${design === d ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {d}{d === TOPIC_PAGE_DESIGN ? ' ·yayında' : ''}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
