'use client';

// Akşam hatırlatması (Web Push) aboneliği — anasayfa kartı (PushReminderOptIn) ve Profilim →
// Ayarlar ortak kullanır (2026-10-02). Abonelik CİHAZ başınadır: bir tarayıcıda açmak diğerini
// etkilemez. Bildirim izni SADECE kullanıcı butona basınca istenir; service worker da o an kaydedilir.
// iPhone'da Web Push yalnızca "Ana ekrana ekle" ile açılmış sitede çalışır.
import { useCallback, useEffect, useState } from 'react';

export type PushReminderState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'available' | 'subscribed' | 'working' | 'error';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function detectState(): Promise<PushReminderState> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
  if (!supported) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'available';
}

export function usePushReminder() {
  const [state, setState] = useState<PushReminderState>('loading');

  useEffect(() => {
    let cancelled = false;
    detectState()
      .catch((): PushReminderState => 'unsupported')
      .then((s) => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState(res.ok ? 'subscribed' : 'error');
    } catch {
      setState('error');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState('working');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState('available');
    } catch {
      setState('error');
    }
  }, []);

  return { state, subscribe, unsubscribe };
}
