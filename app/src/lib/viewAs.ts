'use client';

// Admin'in "şu rolde gör" seçimi (2026-11-17). Header'daki rol menüsünden seçilir, değiştirilene kadar
// (sayfa yenilense de) her sayfada geçerli kalır. Yalnız GÖRÜNÜMÜ değiştirir: sunucudaki yetki kontrolleri
// (requireAdmin, RLS, isViewerAdmin) gerçek rolle çalışmaya devam eder. Öğrenci görünümündeki ilerleme
// verisi admin'in kendi verisidir; başka birinin hesabına bürünme değildir.
//
// Seçim kullanıcı id'siyle birlikte saklanır: aynı tarayıcıda başka biri giriş yaparsa uygulanmaz.
// Uygulayan yerler: AuthContext (misafir → user/isAuthenticated boş), useProfileRole (öğrenci/öğretmen),
// HomeClient, useQuestionBankViewer.
import { useMemo, useSyncExternalStore } from 'react';

export type ViewAsRole = 'student' | 'teacher' | 'guest';
type Stored = { userId: string; role: ViewAsRole };

const KEY = 'dt-view-as';
const EVENT = 'dt-view-as-change';
const ROLES: readonly ViewAsRole[] = ['student', 'teacher', 'guest'];

export const VIEW_AS_LABEL: Record<ViewAsRole | 'admin', string> = {
  admin: 'Admin',
  student: 'Öğrenci',
  teacher: 'Öğretmen',
  guest: 'Misafir',
};

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Stored>;
    return typeof v.userId === 'string' && ROLES.includes(v.role as ViewAsRole) ? (v as Stored) : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT, cb);
  };
}

/** Seçimi kaydeder; null = gerçek rolüne (admin) dön. */
export function setViewAs(userId: string, role: ViewAsRole | null) {
  try {
    if (role) window.localStorage.setItem(KEY, JSON.stringify({ userId, role }));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Depolama kapalıysa seçim yalnız bu sayfa için geçerli olamaz; sessizce yok say.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Bu kullanıcı için kayıtlı görünüm rolü (yoksa null). Sunucu render'ında hep null. */
export function useViewAs(userId: string | null | undefined): ViewAsRole | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => {
    const stored = parse(raw);
    return userId && stored?.userId === userId ? stored.role : null;
  }, [raw, userId]);
}
