'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import {
  classifyLandingGroup,
  classifySource,
  detectAppMode,
  detectDeviceType,
  type VisitorType,
} from '../lib/traffic';

// Ziyaretçi ve üyelerin cihaz/kaynak/sayfa grubu bilgisini saatte en fazla 1 kez gönderir.
// - 60 dk dolmadan sunucuya hiç istek atılmaz (localStorage kilidi).
// - Misafir olarak kaydedilip 1 saat içinde üye girişi yapanlar "member" olarak 1 kez güncellenir.
// - 2 sn bekleme + navigator.webdriver kontrolü ile botların çoğu elenir.
const STORAGE_KEY = 'dt_traffic_ping_v1';
const COOLDOWN_MS = 60 * 60 * 1000;
const SETTLE_MS = 2000;

type StoredPing = { ts: number; type: VisitorType };

function readStoredPing(): StoredPing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPing>;
    if (typeof parsed.ts === 'number' && (parsed.type === 'guest' || parsed.type === 'member')) {
      return { ts: parsed.ts, type: parsed.type };
    }
  } catch {
    // localStorage kapalıysa/bozuksa null döner.
  }
  return null;
}

function writeStoredPing(ping: StoredPing) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ping));
  } catch {
    // Sessizce atla (gizli sekme kota hatası vb.).
  }
}

export function TrafficTracker() {
  const pathname = usePathname();
  const { realUser, loading } = useAuth();
  const realUserId = realUser?.id ?? null;

  useEffect(() => {
    if (loading || !pathname || pathname.startsWith('/admin')) return;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;

    const currentType: VisitorType = realUserId ? 'member' : 'guest';
    const prev = readStoredPing();
    const now = Date.now();
    const withinCooldown = prev !== null && now - prev.ts < COOLDOWN_MS;
    const upgradedToMember = prev?.type === 'guest' && currentType === 'member';

    if (withinCooldown && !upgradedToMember) return;

    const timer = window.setTimeout(() => {
      const latest = readStoredPing();
      const t = Date.now();
      const stillWithin = latest !== null && t - latest.ts < COOLDOWN_MS;
      const stillUpgrade = latest?.type === 'guest' && currentType === 'member';
      if (stillWithin && !stillUpgrade) return;

      writeStoredPing({ ts: t, type: currentType });

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

      const payload = {
        device_type: detectDeviceType(
          window.innerWidth,
          window.matchMedia('(pointer: coarse)').matches,
        ),
        app_mode: detectAppMode(navigator.userAgent || '', isStandalone),
        source_group: classifySource(document.referrer, location.search, location.host),
        landing_group: classifyLandingGroup(pathname),
      };

      fetch('/api/track/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Ağ hatası sayfa deneyimini etkilemez.
      });
    }, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [loading, pathname, realUserId]);

  return null;
}
