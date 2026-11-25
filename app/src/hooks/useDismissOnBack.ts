'use client';

// Merkezi mobil "Geri" tuşu / kenardan kaydırma (back-swipe) yığın yöneticisi.
// URL'yi (pathname, ?query, #hash) HİÇ değiştirmeden window.history.pushState ile görünmez katman
// kaydı tutar:
// 1. Mobilde Geri'ye basıldığında sayfadan çıkmak yerine yalnız en üstteki açık katman kapanır.
// 2. Ekrandaki ✕ / Vazgeç / Escape ile kapatıldığında eklenen geçmiş kaydı otomatik geri alınır
//    ("hayalet geri kaydı" kalmaz).
// 3. Bir çekmeceden tam ekran araca geçildiğinde (ör. Araçlar -> Etkileşimli Ders / Slayt -> Test)
//    derinlik korunduğu için fazladan geri kaydı birikmez; araçtan çıkınca doğrudan sayfaya dönülür.
// 4. İç içe katmanlarda (ör. Etkileşimli Ders -> Bölüm İçi -> Görsel Büyütme) her Geri basışı
//    yalnız bir üst katmanı soyar; en dış X kapatılırsa tüm alt katmanlar tek history.go(-N) ile temizlenir.
import { useEffect, useRef } from 'react';

interface StackEntry {
  id: number;
  onDismiss: () => void;
  canDismiss?: () => boolean;
}

const SESSION_KEY = '__agyOverlaySession';
const DEPTH_KEY = '__agyOverlayDepth';
const SESSION_ID = `agy_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

let nextEntryId = 1;
const activeStack: StackEntry[] = [];
let listenersBound = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingGo = false;
let lastKnownDepth = 0;
let lastLocationKey = '';
let suppressBackUntil = 0;

function currentLocationKey(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
}

function readHistoryDepth(state: unknown): number {
  if (!state || typeof state !== 'object') return 0;
  const rec = state as Record<string, unknown>;
  if (rec[SESSION_KEY] !== SESSION_ID) return 0;
  const d = rec[DEPTH_KEY];
  return typeof d === 'number' && Number.isInteger(d) && d > 0 ? d : 0;
}

function getCurrentHistoryDepth(): number {
  if (typeof window === 'undefined') return 0;
  return readHistoryDepth(window.history.state);
}

function scheduleSync() {
  if (typeof window === 'undefined') return;
  if (syncTimer !== null) return;
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncHistory();
  }, 0);
}

function syncHistory() {
  if (typeof window === 'undefined') return;
  if (pendingGo) return;

  const locKey = currentLocationKey();
  if (lastLocationKey && locKey !== lastLocationKey) {
    // Başka bir sayfaya geçildi; eski sayfanın geri alma işlemini iptal et.
    lastLocationKey = locKey;
    suppressBackUntil = 0;
  } else if (!lastLocationKey) {
    lastLocationKey = locKey;
  }

  const desiredDepth = activeStack.length;
  const actualDepth = getCurrentHistoryDepth();
  lastKnownDepth = actualDepth;

  if (desiredDepth > actualDepth) {
    suppressBackUntil = 0;
    const baseState =
      window.history.state && typeof window.history.state === 'object'
        ? (window.history.state as Record<string, unknown>)
        : {};
    for (let d = actualDepth + 1; d <= desiredDepth; d++) {
      window.history.pushState(
        {
          ...baseState,
          [SESSION_KEY]: SESSION_ID,
          [DEPTH_KEY]: d,
        },
        '',
        window.location.href,
      );
    }
    lastKnownDepth = desiredDepth;
    return;
  }

  if (actualDepth > desiredDepth) {
    // Açık bir çekmece/pencere içinden başka bir sayfaya (<Link href="/...">) tıklandıysa,
    // Next.js'in asenkron sayfa geçişini iptal etmemek için history.go(-N) çağırma.
    if (Date.now() < suppressBackUntil) return;
    pendingGo = true;
    window.history.go(desiredDepth - actualDepth);
  }
}

function handlePopState(event: PopStateEvent) {
  const locKey = currentLocationKey();
  const sameRoute = !lastLocationKey || locKey === lastLocationKey;
  lastLocationKey = locKey;

  const newDepth = readHistoryDepth(event.state);
  const wasDepth = lastKnownDepth;

  // Gerçek sayfa değişimi (ör. /profil sayfasından önceki sayfaya dönüş): Next.js router'a bırak.
  if (!sameRoute) {
    pendingGo = false;
    suppressBackUntil = 0;
    lastKnownDepth = 0;
    if (newDepth > 0 && window.history.state && typeof window.history.state === 'object') {
      const cleaned = { ...(window.history.state as Record<string, unknown>) };
      delete cleaned[SESSION_KEY];
      delete cleaned[DEPTH_KEY];
      window.history.replaceState(cleaned, '', window.location.href);
    }
    while (activeStack.length > 0) {
      const top = activeStack.pop()!;
      top.onDismiss();
    }
    return;
  }

  const isOverlayTraversal = pendingGo || wasDepth > 0 || newDepth > 0 || activeStack.length > 0;
  if (!isOverlayTraversal) return;

  // Aynı sayfa içindeki katman kapanışlarında Next.js App Router'ın ACTION_RESTORE çalıştırıp
  // history.state üzerindeki katman derinliğini ezmesini engelle.
  event.stopImmediatePropagation();
  lastKnownDepth = newDepth;

  if (pendingGo) {
    pendingGo = false;
    if (activeStack.length > newDepth) {
      while (activeStack.length > newDepth) {
        const top = activeStack[activeStack.length - 1];
        if (top.canDismiss && !top.canDismiss()) break;
        activeStack.pop();
        top.onDismiss();
      }
    }
    scheduleSync();
    return;
  }

  // Kullanıcı mobil Geri tuşuna bastı (veya İleri tuşuyla eski katman kaydına geldi).
  if (newDepth < activeStack.length) {
    while (activeStack.length > newDepth) {
      const top = activeStack[activeStack.length - 1];
      if (top.canDismiss && !top.canDismiss()) {
        // Kapatma geçici olarak kilitliyse (ör. yazılı AI puanlaması sürerken) geçmiş kaydını geri koy.
        break;
      }
      activeStack.pop();
      top.onDismiss();
    }
  }
  scheduleSync();
}

function handleDocumentClickCapture(event: MouseEvent) {
  if (activeStack.length === 0) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as Element | null;
  const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return;
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
    return;
  }
  try {
    const dest = new URL(anchor.href, window.location.href);
    if (dest.origin !== window.location.origin) {
      suppressBackUntil = Date.now() + 2000;
      return;
    }
    const isDifferentRoute =
      dest.pathname !== window.location.pathname || dest.search !== window.location.search;
    const isHashJump = !isDifferentRoute && Boolean(dest.hash) && dest.hash !== window.location.hash;
    if (isDifferentRoute || isHashJump) {
      suppressBackUntil = Date.now() + 1800;
    }
  } catch {
    // Geçersiz URL — yok say.
  }
}

function ensureListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  lastLocationKey = currentLocationKey();
  lastKnownDepth = getCurrentHistoryDepth();
  window.addEventListener('popstate', handlePopState, true);
  document.addEventListener('click', handleDocumentClickCapture, true);
}

/**
 * Sayfa içi tam ekran araç, modal, çekmece veya görsel büyütme açıkken (`active === true`)
 * mobil Geri tuşunu yakalayıp sayfadan çıkmak yerine `onDismiss` çağırır.
 */
export function useDismissOnBack(
  active: boolean,
  onDismiss: () => void,
  options?: { canDismiss?: () => boolean },
) {
  const onDismissRef = useRef(onDismiss);
  const canDismissRef = useRef(options?.canDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    canDismissRef.current = options?.canDismiss;
  });

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    ensureListeners();

    const id = nextEntryId++;
    const entry: StackEntry = {
      id,
      onDismiss: () => onDismissRef.current(),
      canDismiss: () => (canDismissRef.current ? canDismissRef.current() : true),
    };
    activeStack.push(entry);
    scheduleSync();

    return () => {
      const idx = activeStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        activeStack.splice(idx, 1);
        scheduleSync();
      }
    };
  }, [active]);
}
