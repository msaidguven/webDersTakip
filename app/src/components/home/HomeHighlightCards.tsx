// Anasayfa vurgu kartları (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
// ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Renkli bantlar kaldırıldı: beyaz kart, ince
// çerçeve, ders rengi yalnız küçük nokta/ikonda, "Yeni" ve "3. hafta" açık mor küçük etiket.
import Link from 'next/link';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import { SubjectIcon } from './SubjectIcon';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

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

export function RecentTopicsCard({ topics, gradeName }: { topics: RecentTopicItem[]; gradeName?: string | null }) {
  if (!topics.length) return null;
  return (
    <section aria-labelledby="yeni-eklenenler" className="flex flex-col">
      <h2 id="yeni-eklenenler" className="text-xl font-bold tracking-tight text-default">
        {gradeName ? 'Sınıfına yeni gelenler' : 'Yeni eklenenler'}
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">{gradeName ? `${gradeName} · son eklenen 5 konu` : 'Siteye son eklenen konu anlatımları'}</p>
      <ul className="flex-1 divide-y divide-[var(--border)] rounded-[20px] border border-default bg-background px-4 sm:px-5">
        {topics.map((t) => (
          <RowLink key={t.id} href={t.href}>
            <SubjectIcon lessonName={t.lessonName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className={titleCls}>{t.title}</span>
              <span className="text-sm text-muted-foreground">{gradeName ? t.lessonName : `${t.lessonName} · ${t.gradeName}`}</span>
            </span>
            {t.isNew ? (
              <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Yeni</span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">{dateFormatter.format(new Date(t.publishedAt))}</span>
            )}
          </RowLink>
        ))}
      </ul>
    </section>
  );
}
