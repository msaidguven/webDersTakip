// Soru bankası sayfalarının sağ sütunundaki hiyerarşi gezinmesi (2026-10-03, kullanıcı isteği):
// sınıfın dersleri / dersin üniteleri / ünitenin konuları — TÜMÜ listelenir, bulunulan yer vurgulu
// ("buradasın"). Bulunulan sayfanın kendisi link değildir (aria-current="page"); üst seviyedeki
// vurgulu öğe (ör. konu sayfasındaki ünite) kendi sayfasına link olarak kalır.
// Sunucu bileşeni — tamamı ISR HTML'inde, iç linkleme (SEO) için.
import Link from 'next/link';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { subjectStyle } from '@/app/src/lib/subjectStyle';

export interface SoruBankasiNavItem {
  key: string | number;
  href: string;
  label: string;
  /** Üst satır, ör. "2. ünite". */
  eyebrow?: string;
  meta: string;
  /** Görsel yoksa ders renginde ikon. */
  imageUrl?: string | null;
  /** Görsel/ikon yerine kısa metin rozeti (ör. sınıf numarası "6"). */
  badge?: string;
  /** İkonun hangi dersin rengiyle çizileceği (badge varsa kullanılmaz). */
  lessonName: string;
  current: boolean;
  /** current öğe bu sayfanın kendisi mi (link değil) yoksa üst seviye mi (link kalır). */
  isPage?: boolean;
}

function Visual({ item }: { item: SoruBankasiNavItem }) {
  if (item.badge) {
    return (
      <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-base font-bold text-white" aria-hidden="true">
        {item.badge}
      </span>
    );
  }
  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="h-10 w-14 shrink-0 rounded-lg bg-surface-elevated object-cover" />;
  }
  return (
    <span className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border ${subjectStyle(item.lessonName).tint}`} aria-hidden="true">
      <SubjectIcon lessonName={item.lessonName} size="sm" variant="solid" />
    </span>
  );
}

export function SoruBankasiNavList({ id, title, items, footer }: { id: string; title: string; items: SoruBankasiNavItem[]; footer?: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="rounded-[20px] border border-default bg-background p-5">
      <h2 id={id} className="font-semibold text-default">{title}</h2>
      <ol className="mt-3 flex flex-col gap-2">
        {items.map((item) => {
          const body = (
            <>
              <Visual item={item} />
              <span className="min-w-0">
                {(item.eyebrow || item.current) && (
                  <span className={`block text-xs font-semibold ${item.current ? 'text-indigo-700 dark:text-indigo-300' : 'text-muted-foreground'}`}>
                    {[item.eyebrow, item.current ? 'buradasın' : null].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span
                  className={`block text-sm font-semibold leading-snug ${
                    item.current ? 'text-indigo-900 dark:text-indigo-100' : 'text-default group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground">{item.meta}</span>
              </span>
            </>
          );
          const base = 'flex items-center gap-3 rounded-xl border p-2';
          const currentCls = 'border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/15';
          return (
            <li key={item.key}>
              {item.current && item.isPage ? (
                <div aria-current="page" className={`${base} ${currentCls}`}>
                  {body}
                </div>
              ) : (
                <Link
                  href={item.href}
                  aria-current={item.current ? 'location' : undefined}
                  className={`group ${base} transition-colors ${item.current ? currentCls : 'border-default hover:border-indigo-300'}`}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      {footer && <div className="mt-4 flex flex-col gap-1.5 border-t border-default pt-3 text-sm">{footer}</div>}
    </section>
  );
}
