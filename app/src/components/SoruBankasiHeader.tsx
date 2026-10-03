// Soru bankası sayfalarının ortak üst bölümü (2026-10-03 yenilemesi; sınıf/ders/ünite/konu):
// sayfa yolu, ders ikonlu üst satır, H1, özet etiketleri, veriden türetilmiş özgün giriş metni,
// isteğe bağlı ek içerik (kazanım, düğmeler) ve masaüstünde sağda görsel.
import Link from 'next/link';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';

export interface Crumb {
  name: string;
  href: string;
}

export function SoruBankasiHeader({
  crumbs,
  lessonName,
  eyebrow,
  title,
  pills,
  intro,
  imageUrl,
  imageAlt,
  children,
}: {
  crumbs: Crumb[];
  /** Verilirse üst satırda o dersin ikonu. */
  lessonName?: string;
  eyebrow: string;
  title: string;
  pills: string[];
  intro?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      {crumbs.length > 0 && (
        <nav aria-label="Konum">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="opacity-50">›</span>}
                <Link href={c.href} className="transition-colors hover:text-default">{c.name}</Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <header className={`mt-5 grid items-center gap-8 ${imageUrl ? 'md:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {lessonName && <SubjectIcon lessonName={lessonName} size="sm" variant="solid" />}
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-default sm:text-4xl">{title}</h1>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground" aria-label="Sayfa özeti">
            {pills.map((t) => (
              <li key={t} className="rounded-full bg-surface-elevated px-2.5 py-1">{t}</li>
            ))}
          </ul>
          {intro && <p className="mt-4 max-w-[62ch] leading-relaxed text-muted-foreground">{intro}</p>}
          {children}
        </div>
        {imageUrl && (
          // Mobilde gizli (içerik yukarı gelsin); masaüstünde başlığın yanında.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt ?? ''} className="hidden aspect-[16/10] w-full rounded-[20px] border border-default bg-surface-elevated object-cover md:block" />
        )}
      </header>
    </>
  );
}

/** Türkçe liste birleştirme: "a, b ve c". */
export function joinTr(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ve ${parts.at(-1)}` : (parts[0] ?? '');
}

export const pageShellCls = 'bg-[#FAFAF8] dark:bg-background';
export const pageInnerCls = 'mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10';
