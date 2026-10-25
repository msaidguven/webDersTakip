"use client";

import { useEffect, useState } from "react";

// Tema tercihi: kaynak <html class="dark"> (layout.tsx ilk boyamadan önce localStorage'dan kurar; site
// varsayılan olarak açık tema açılır, koyu yalnız bilinçli seçilince). 2026-10-21: header'daki düğme ve
// header menüsündeki tema satırı aynı anda ekranda olabildiği için durum tek yerde (DOM) tutulur ve
// değişince "dt-theme" olayıyla diğer örneklere duyurulur.
const THEME_EVENT = "dt-theme";

export function useThemeMode(): [isDark: boolean | null, toggle: () => void] {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // gizli pencere vb. — tercih bu oturumla sınırlı kalır
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return [isDark, toggle];
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, toggle] = useThemeMode();

  // Client-side render olana kadar placeholder göster
  if (isDark === null) {
    return (
      <button
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default ${className}`}
        aria-label="Tema yükleniyor"
      />
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default flex items-center justify-center hover:bg-surface-elevated hover:border-default/20 transition-all text-sm ${className}`}
    >
      {isDark ? "🌞" : "🌙"}
    </button>
  );
}
