'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';

type AdminTheme = 'dark' | 'light';

interface AdminThemeContextValue {
  theme: AdminTheme;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'admin-theme';

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function readStoredTheme(): AdminTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function getServerTheme(): AdminTheme {
  return 'dark';
}

// localStorage'daki tercih değişince (bu sekmede toggleTheme'in dispatch ettiği sentetik
// 'storage' event'i ya da başka bir sekmedeki gerçek değişiklik) yeniden okunsun diye.
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR ve ilk client render'da hep 'dark' (hydration uyumu için), mount sonrası gerçek
  // tercih useSyncExternalStore ile senkron okunuyor — setState-in-effect'in yol açtığı
  // ekstra render/flicker olmadan.
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerTheme);

  const toggleTheme = () => {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // yoksay
    }
    // Native 'storage' event'i sadece DİĞER sekmelerde tetiklenir; aynı sekmede
    // useSyncExternalStore'u yeniden okutmak için burada elle dispatch ediyoruz.
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <AdminThemeContext.Provider value={{ theme, toggleTheme }}>
      {/* Sadece 'dark' değil, 'light' de EXPLICIT class olarak veriliyor — <html> üstte
          zaten .dark taşıyorsa (ör. OS/tarayıcı karanlık tercihi, bkz. app/layout.tsx'teki
          setThemeScript) boş className ile açık tema tokenları geri kazanılamazdı, çünkü
          :root sadece gerçek kök elemanı eşler; .light bunun için app/globals.css'te ayrıca
          tanımlı. */}
      <div className={theme === 'dark' ? 'dark' : 'light'}>{children}</div>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) {
    throw new Error('useAdminTheme, AdminThemeProvider içinde kullanılmalıdır');
  }
  return ctx;
}
