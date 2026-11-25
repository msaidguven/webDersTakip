"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import r from "./robotic/robotic.module.css";

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
  // MainLayout `hidden lg:flex` gönderdiğinde sabit `flex` sınıfı `hidden` ile çakışmasın;
  // r.iconBtn kendi içinde `display: flex` tanımladığı için `hidden` durumunda `!hidden lg:!flex` ile net gizlenir.
  const visibilityCls = /\bhidden\b/.test(className)
    ? className.replace(/\bhidden\b/, "!hidden").replace(/\blg:flex\b/, "lg:!flex")
    : className;

  // Client-side render olana kadar placeholder göster
  if (isDark === null) {
    return (
      <button
        type="button"
        className={`w-9 h-9 sm:w-10 sm:h-10 ${r.iconBtn} ${visibilityCls}`}
        aria-label="Tema yükleniyor"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className={`w-9 h-9 sm:w-10 sm:h-10 active:scale-95 ${r.iconBtn} ${visibilityCls}`}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] text-amber-400" aria-hidden="true" />
      ) : (
        <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
