'use client';

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Salt okunur demo hesap (Google Play inceleme hesabı, bkz. proxy.ts → demoReadOnlyResponse):
// admin API'si değişiklik isteklerini x-demo-readonly başlığıyla cevaplar; burada fetch'i
// sarmalayıp o başlığı görünce ekranda kısa bir bildirim gösteriyoruz. Yalnız app_metadata.read_only
// olan kullanıcıda devreye girer, diğer herkes için hiçbir şey yapmaz.
const MESSAGES: Record<string, string> = {
  delete: 'Demo hesap: silme yalnızca ekranda gösterildi, gerçek veri silinmedi.',
  write: 'Demo hesap: değişiklikler kaydedilmez.',
};

function showToast(text: string) {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    maxWidth: 'calc(100vw - 32px)',
    padding: '12px 16px',
    borderRadius: '10px',
    background: '#1f2937',
    color: '#fff',
    fontSize: '14px',
    lineHeight: '1.4',
    boxShadow: '0 8px 24px rgba(0,0,0,.3)',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function DemoReadOnlyNotice() {
  const { user } = useAuth();
  const readOnly = user?.app_metadata?.read_only === true;

  useEffect(() => {
    if (!readOnly) return;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      const kind = res.headers.get('x-demo-readonly');
      if (kind) showToast(MESSAGES[kind] ?? MESSAGES.write);
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [readOnly]);

  return null;
}
