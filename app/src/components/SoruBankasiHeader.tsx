// Soru bankası sayfalarının ortak üst bölümü (2026-10-03 yenilemesi; sınıf/ders/ünite/konu):
// sayfa yolu, ders ikonlu üst satır, H1, özet etiketleri, veriden türetilmiş özgün giriş metni,
// isteğe bağlı ek içerik (kazanım, düğmeler) ve masaüstünde sağda görsel.
import Link from 'next/link';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { roboticFontVars } from './robotic/fonts';
import r from './robotic/robotic.module.css';

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
                <Link href={c.href} className={r.hoverAccent}>{c.name}</Link>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <header className={`relative mt-5 grid items-center gap-8 p-5 sm:p-7 ${r.panel} ${r.hero} ${imageUrl ? 'md:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <span className={r.scan} aria-hidden="true" />
        <div>
          <p className={`flex items-center gap-2 ${r.label}`}>
            {lessonName && <SubjectIcon lessonName={lessonName} size="sm" variant="solid" />}
            {eyebrow}
          </p>
          <h1 className={`mt-3 text-3xl leading-tight sm:text-4xl ${r.chrome}`}>{title}</h1>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sayfa özeti">
            {pills.map((t) => (
              <li key={t} className={r.badge}>{t}</li>
            ))}
          </ul>
          {intro && <p className="mt-4 max-w-[62ch] leading-relaxed text-muted-foreground">{intro}</p>}
          {children}
        </div>
        {imageUrl && (
          // Mobilde gizli (içerik yukarı gelsin); masaüstünde başlığın yanında.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={imageAlt ?? ''} className={`hidden aspect-[16/10] w-full rounded-[16px] object-cover md:block ${r.item}`} />
        )}
      </header>
    </>
  );
}

/** Türkçe liste birleştirme: "a, b ve c". */
export function joinTr(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ve ${parts.at(-1)}` : (parts[0] ?? '');
}

// Robotik tema kökü (2026-10-19) — tüm soru bankası seviyeleri bu kabuğu kullanır.
export const pageShellCls = `${roboticFontVars} ${r.root}`;
export const pageInnerCls = 'mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10';
