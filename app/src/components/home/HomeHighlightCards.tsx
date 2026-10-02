// Anasayfa vurgu kartları (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
// ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Renkli bantlar kaldırıldı: beyaz kart, ince
// çerçeve, ders rengi yalnız küçük nokta/ikonda, "Yeni" ve "3. hafta" açık mor küçük etiket.
import Link from 'next/link';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import { SubjectIcon } from './SubjectIcon';

function RowLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = 'group flex items-center gap-3 py-3';
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {children}
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </li>
  );
}

const titleCls = 'block font-medium leading-snug text-default transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400';

export function SchoolThisWeekCard({ gradeName, week, topics }: { gradeName: string; week: number; topics: ThisWeekTopicItem[] }) {
  if (!topics.length) return null;
  return (
    <section aria-labelledby="okulda-bu-hafta" className="rounded-[20px] border border-default bg-background p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="okulda-bu-hafta" className="font-semibold text-default">
          Okulda bu hafta
        </h2>
        <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{week}. hafta</span>
      </div>
      <p className="mb-1 text-sm text-muted-foreground">{gradeName} · müfredat takvimine göre</p>
      <ul className="divide-y divide-[var(--border)]">
        {topics.map((t) => (
          <RowLink key={t.id} href={t.href}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${subjectStyle(t.lessonName).bar}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={`${titleCls} text-[15px]`}>{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.lessonName}</span>
            </span>
          </RowLink>
        ))}
      </ul>
    </section>
  );
}

// Yeni eklenenler (2026-10-02, referans tasarımın kapak görselli konu kartları): görsel varsa kapak,
// yoksa dersin açık renginde zemin + dolgulu ikon. Görseller sayfanın aşağısında → lazy, hızı etkilemez.
export function RecentTopicsCard({ topics, gradeName }: { topics: RecentTopicItem[]; gradeName?: string | null }) {
  if (!topics.length) return null;
  return (
    <section aria-labelledby="yeni-eklenenler" className="flex flex-col">
      {gradeName ? (
        // Giriş yapmış görünüm: ayrı başlık yerine tek satır (kullanıcı isteği, 2026-10-02); yine h2, bölüm etiketi kalsın.
        <h2 id="yeni-eklenenler" className="mb-4 text-lg font-semibold text-default">
          {gradeName} · son eklenen konu anlatımları
        </h2>
      ) : (
        <>
          <h2 id="yeni-eklenenler" className="text-2xl font-bold tracking-tight text-default">
            Yeni eklenenler
          </h2>
          <p className="mb-5 mt-1 text-muted-foreground">Siteye son eklenen konu anlatımları</p>
        </>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {topics.map((t) => {
          const st = subjectStyle(t.lessonName);
          const body = (
            <>
              <span className={`relative flex aspect-[16/10] items-center justify-center overflow-hidden ${t.imageUrl ? 'bg-surface-elevated' : st.tint}`}>
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <SubjectIcon lessonName={t.lessonName} variant="solid" size="lg" />
                )}
                {t.isNew && (
                  <span className="absolute left-2 top-2 rounded-md bg-background/95 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-sm dark:text-indigo-300">Yeni</span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-default transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                  {t.title}
                </span>
                <span className="mt-auto truncate text-xs text-muted-foreground">{gradeName ? t.lessonName : `${t.gradeName} · ${t.lessonName}`}</span>
              </span>
            </>
          );
          const cls = 'group flex h-full flex-col overflow-hidden rounded-2xl border border-default bg-background transition-shadow hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)]';
          return (
            <li key={t.id}>
              {t.href ? (
                <Link href={t.href} className={cls}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
