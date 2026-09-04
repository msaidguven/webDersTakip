'use client';

import { useAdminTheme } from '@/app/src/components/admin/AdminThemeProvider';

export default function AdminThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      aria-label={isDark ? 'Açık temaya geç' : 'Koyu temaya geç'}
      className={`inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 ${className}`}
    >
      <span className="text-sm sm:text-base leading-none">{isDark ? '🌙' : '☀️'}</span>
    </button>
  );
}
