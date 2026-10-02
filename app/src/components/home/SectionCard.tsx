// Anasayfa bölüm kartı (2026-10-02, kullanıcı isteği: "her bölüme güzel bir card, sayfa renkli").
// Tüm bölümler aynı dili konuşur: renkli başlık bandı (ikon + başlık + alt başlık + isteğe bağlı
// sağ bağlantı) ve beyaz gövde. Başlık gerçek <h2> — SEO ve ekran okuyucu için bölüm yapısı korunur.
// Bant renkleri beyaz yazıyla WCAG AA (amber hariç: koyu yazı).
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export type SectionTone = 'sky' | 'indigo' | 'emerald' | 'amber' | 'orange' | 'violet' | 'rose';

const TONES: Record<SectionTone, { band: string; border: string; text: string; sub: string; iconBg: string }> = {
  sky: { band: 'bg-sky-700', border: 'border-sky-200 dark:border-sky-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
  indigo: { band: 'bg-indigo-600', border: 'border-indigo-200 dark:border-indigo-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
  emerald: { band: 'bg-emerald-700', border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
  amber: { band: 'bg-amber-400', border: 'border-amber-200 dark:border-amber-500/30', text: 'text-amber-950', sub: 'text-amber-950/80', iconBg: 'bg-white/40' },
  orange: { band: 'bg-orange-700', border: 'border-orange-200 dark:border-orange-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
  violet: { band: 'bg-violet-600', border: 'border-violet-200 dark:border-violet-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
  rose: { band: 'bg-rose-600', border: 'border-rose-200 dark:border-rose-500/30', text: 'text-white', sub: 'text-white/90', iconBg: 'bg-white/20' },
};

export function SectionCard({
  tone,
  icon,
  title,
  subtitle,
  headingId,
  action,
  id,
  className = '',
  bodyClassName = '',
  children,
}: {
  tone: SectionTone;
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  headingId: string;
  action?: { href: string; label: string };
  id?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <section id={id} aria-labelledby={headingId} className={`flex flex-col overflow-hidden rounded-3xl border bg-background ${t.border} ${className}`}>
      <div className={`flex items-center gap-3 px-5 py-4 ${t.band} ${t.text}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${t.iconBg}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <h2 id={headingId} className="text-lg font-black leading-tight">
            {title}
          </h2>
          {subtitle && <span className={`block text-[13px] font-semibold ${t.sub}`}>{subtitle}</span>}
        </span>
        {action && (
          <Link
            href={action.href}
            className={`inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-extrabold transition-colors ${t.iconBg} hover:bg-white/30`}
          >
            {action.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
