'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X } from 'lucide-react';
import {
  LATEST_ANDROID_VERSION_CODE,
  MIN_ANDROID_VERSION_CODE,
  PLAY_STORE_URL,
  dismissUpdateFor,
  isUpdateDismissedFor,
  persistAndroidAppVersion,
  readAndroidAppVersion,
} from '@/app/src/lib/androidAppVersion';

const subscribeNoop = () => () => {};

function getClientAppVersion(): number | null {
  return readAndroidAppVersion(window.location.search);
}

function getClientDismissed(): boolean {
  return isUpdateDismissedFor(LATEST_ANDROID_VERSION_CODE);
}

// Android TWA uygulamasından gelen ve sürümü LATEST_ANDROID_VERSION_CODE'dan eski olan
// kullanıcılara Play Store güncelleme uyarısı gösterir. Normal web ziyaretçilerinde görünmez.
export function AndroidUpdateBanner() {
  const pathname = usePathname() ?? '';
  const appVersion = useSyncExternalStore(subscribeNoop, getClientAppVersion, () => null);
  const dismissedInStorage = useSyncExternalStore(subscribeNoop, getClientDismissed, () => false);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  useEffect(() => {
    persistAndroidAppVersion(window.location.search);
  }, [pathname]);

  if (pathname.startsWith('/admin')) return null;
  if (appVersion === null) return null;
  if (appVersion >= LATEST_ANDROID_VERSION_CODE) return null;

  const isForced = appVersion < MIN_ANDROID_VERSION_CODE;
  if (!isForced && (dismissedLocally || dismissedInStorage)) return null;

  function handleDismiss() {
    dismissUpdateFor(LATEST_ANDROID_VERSION_CODE);
    setDismissedLocally(true);
  }

  return (
    <div role="status" className="px-3 sm:px-8 pt-3">
      <div className="max-w-7xl mx-auto flex items-start sm:items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 sm:p-4">
        <Download
          className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5 sm:mt-0"
          aria-hidden="true"
        />
        <p className="flex-1 min-w-0 text-sm text-default">
          <span className="font-semibold">Yeni bir sürüm mevcut!</span>{' '}
          Daha iyi bir deneyim için Ders Takip uygulamasını Google Play üzerinden güncelleyebilirsin.
        </p>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.98] transition-transform"
        >
          Güncelle
        </a>
        {!isForced && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Güncelleme uyarısını kapat"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-default hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
