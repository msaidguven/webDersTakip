"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Client-side'da çalıştır
    try {
      const t = localStorage.getItem("theme");
      let initialValue: boolean;
      if (t) {
        initialValue = t === "dark";
      } else {
        initialValue = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      setIsDark(initialValue);

      // DOM'u güncelle
      if (initialValue) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    // isDark değiştiğinde DOM'u güncelle
    if (isDark === null) return;

    try {
      if (isDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) { }
  }, [isDark]);

  // Client-side render olana kadar placeholder göster
  if (isDark === null) {
    return (
      <button
        className="p-2 rounded-lg hover:bg-zinc-100/50 dark:hover:bg-white/5 transition-colors text-sm w-10 h-10"
        aria-label="Loading theme"
      />
    );
  }

  return (
    <button
      onClick={() => setIsDark((v) => !v)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Açık tema" : "Koyu tema"}
      className="p-2 rounded-lg hover:bg-zinc-100/50 dark:hover:bg-white/5 transition-colors text-sm"
    >
      {isDark ? "🌞" : "🌙"}
    </button>
  );
}