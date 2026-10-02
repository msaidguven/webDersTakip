'use client';

// "Hatırlatma al" (yol haritası 3c, 2026-09-27). Bildirim izni SADECE öğrenci butona basınca
// istenir (sayfa açılır açılmaz istemek hem kaba hem tarayıcılar tarafından engelleniyor).
// Service worker da ancak o an kaydedilir. iPhone'da Web Push yalnızca "Ana ekrana ekle" ile
// açılmış sitede çalışır — orada önce bunu anlatırız.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Share } from 'lucide-react';
import { usePushReminder } from '@/app/src/hooks/usePushReminder';

// Abonelik mantığı usePushReminder'da (Profilim → Ayarlar ile ortak). Bu kart yalnızca hatırlatma
// kapalıyken ve kullanıcı "Şimdi değil" demediyse görünür; ayarın kalıcı yeri Profilim → Ayarlar.
const DISMISS_KEY = 'dt-push-optin-dismissed';

export function PushReminderOptIn() {
  const { state, subscribe } = usePushReminder();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* yok say */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage yalnızca istemcide okunabilir
    setDismissed(wasDismissed);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* yok say */
    }
  };

  if (state === 'loading' || state === 'unsupported' || state === 'subscribed') return null;

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
          <p className="mt-1 text-xs text-muted-foreground">
            İstediğin zaman <Link href="/profil#ayarlar" className="font-bold text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">Profilim → Ayarlar</Link>’dan açıp kapatabilirsin.
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
