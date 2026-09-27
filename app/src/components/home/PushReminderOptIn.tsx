'use client';

// "Hatırlatma al" (yol haritası 3c, 2026-09-27). Bildirim izni SADECE öğrenci butona basınca
// istenir (sayfa açılır açılmaz istemek hem kaba hem tarayıcılar tarafından engelleniyor).
// Service worker da ancak o an kaydedilir. iPhone'da Web Push yalnızca "Ana ekrana ekle" ile
// açılmış sitede çalışır — orada önce bunu anlatırız.
import { useEffect, useState } from 'react';
import { Bell, BellOff, Share } from 'lucide-react';

type State = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'available' | 'subscribed' | 'working' | 'error';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const DISMISS_KEY = 'dt-push-optin-dismissed';

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

async function detectState(): Promise<State> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
  if (!supported) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'subscribed' : 'available';
}

export function PushReminderOptIn() {
  const [state, setState] = useState<State>('loading');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* yok say */
    }
    detectState()
      .catch((): State => 'unsupported')
      .then((s) => {
        if (cancelled) return;
        setDismissed(wasDismissed);
        setState(s);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = async () => {
    setState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setState(res.ok ? 'subscribed' : 'error');
    } catch {
      setState('error');
    }
  };

  const unsubscribe = async () => {
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
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* yok say */
    }
  };

  if (state === 'loading' || state === 'unsupported') return null;

  if (state === 'subscribed') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        Akşam hatırlatmaları açık.
        <button type="button" onClick={() => void unsubscribe()} className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
          Kapat
        </button>
      </p>
    );
  }

  if (dismissed) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          {state === 'denied' ? <BellOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Bell className="h-[18px] w-[18px]" aria-hidden="true" />}
        </span>
        <div className="text-sm">
          <p className="font-bold text-default">Serin bozulmadan haber verelim</p>
          <p className="text-muted-foreground">
            {state === 'ios-install' ? (
              <>
                iPhone’da hatırlatma için önce Safari’de <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Paylaş" /> → “Ana Ekrana Ekle” ile siteyi ekle, oradan aç.
              </>
            ) : state === 'denied' ? (
              'Bildirim izni kapalı. Tarayıcı ayarlarından bu site için bildirimlere izin verirsen hatırlatma gönderebiliriz.'
            ) : state === 'error' ? (
              'Bir sorun oldu, tekrar dener misin?'
            ) : (
              'O gün hiç soru çözmediysen akşam 19:00’da tek bir hatırlatma. Günde en fazla bir kez.'
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {(state === 'available' || state === 'error' || state === 'working') && (
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={state === 'working'}
            className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {state === 'working' ? 'Açılıyor…' : 'Hatırlatmaları aç'}
          </button>
        )}
        <button type="button" onClick={dismiss} className="min-h-11 rounded-xl px-3 text-sm font-bold text-muted-foreground hover:text-default">
          Şimdi değil
        </button>
      </div>
    </div>
  );
}
