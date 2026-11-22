// Soru bankası sayfalarının ortak üst bölümü (2026-10-03 yenilemesi; sınıf/ders/ünite/konu):
// ders ikonlu üst satır (konum yolu ya da eyebrow), H1, özet etiketleri, veriden türetilmiş özgün giriş metni,
// isteğe bağlı ek içerik (kazanım, düğmeler) ve sağ alan: masaüstünde görsel ya da `aside` (ör. sınıf kutuları).
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NeonSubjectIcon } from './robotic/NeonSubjectIcon';
import { roboticFontVars } from './robotic/fonts';
import r from './robotic/robotic.module.css';

// Mobil uygulama üst çubuğu (< 1024px): !sticky (.root > * { position: relative } kuralını geçer).
export function SoruBankasiMobileBar({
  backHref,
  backLabel,
  title,
  badge,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  badge?: string;
}) {
  return (
    <div className={`!sticky top-[3.75rem] z-30 flex items-center gap-3 border-b bg-[color-mix(in_srgb,var(--panel-solid)_90%,transparent)] px-4 py-2.5 backdrop-blur-md sm:top-[4.5rem] sm:px-6 lg:hidden ${r.divider}`}>
      <Link
        href={backHref}
        aria-label={backLabel}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform active:scale-95 ${r.iconBtn}`}
      >
        <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
      </Link>
      <span className={`min-w-0 flex-1 truncate text-sm font-bold text-default ${r.display}`}>
        {title}
      </span>
      {badge && (
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground ${r.divider}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

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
  aside,
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
  /** Başlığın sağında (mobilde altında) gösterilir; görsel yoksa kullanılır. */
  aside?: React.ReactNode;
}) {
  // 2026-10-31 (kullanıcı isteği "kart üstünde tek başına duran '6. Sınıf' yazısı gereksiz, alan sıkışık olsun"):
  // konum yolu kartın içinde, üst satırda (tıklanabilir); yol yoksa eyebrow metni. Mobilde boşluklar daraltıldı.
  return (
    <>
      <header className={`relative grid items-center gap-6 p-4 sm:gap-8 sm:p-7 ${r.panel} ${r.hero} ${imageUrl ? 'md:grid-cols-[minmax(0,1fr)_340px]' : aside ? 'md:grid-cols-[minmax(0,1fr)_auto] md:items-end' : ''}`}>
        <span className={r.scan} aria-hidden="true" />
        <div>
          <div className={`flex items-center gap-2 ${r.label}`}>
            {lessonName && <NeonSubjectIcon lessonName={lessonName} className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />}
            {crumbs.length > 0 ? (
              <nav aria-label="Konum" className="min-w-0">
                <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {crumbs.map((c, i) => (
                    <li key={c.href} className="flex items-center gap-1.5">
                      {i > 0 && <span aria-hidden className="opacity-50">›</span>}
                      <Link href={c.href} className={`underline-offset-2 hover:underline ${r.hoverAccent}`}>{c.name}</Link>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : (
              <p>{eyebrow}</p>
            )}
          </div>
          <h1 className={`mt-2 text-[26px] leading-tight sm:mt-3 sm:text-4xl ${r.chrome}`}>{title}</h1>
          <ul className="sb-seo-pills mt-2.5 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2" aria-label="Sayfa özeti">
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
        {!imageUrl && aside}
      </header>
    </>
  );
}

// Sayfa açıklaması (2026-10-31): soru bankası sayfalarında uzun giriş metni başlıktan alınıp listelerin altına
// kondu — mobilde sınıf/ders/ünite/konu listesine ulaşmak için ekran ekran kaydırmak gerekiyordu. Metin aynı
// sayfada kaldığı için arama motoru açısından fark yok.
export function SoruBankasiAbout({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <section aria-labelledby="sayfa-hakkinda" className={`mt-12 p-5 sm:p-6 ${r.panel}`}>
      <h2 id="sayfa-hakkinda" className={r.label}>Bu sayfa hakkında</h2>
      <p className="mt-2 max-w-[72ch] leading-relaxed text-muted-foreground">{text}</p>
    </section>
  );
}

/** Türkçe liste birleştirme: "a, b ve c". */
export function joinTr(parts: string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ve ${parts.at(-1)}` : (parts[0] ?? '');
}

// Robotik tema kökü (2026-10-19) — tüm soru bankası seviyeleri bu kabuğu kullanır.
export const pageShellCls = `${roboticFontVars} ${r.root}`;
export const pageInnerCls = 'mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-10';
