// Anasayfa vurgu kartları (2026-10-02 sıfırdan tasarım, kullanıcı: "okulda bu hafta ile yeni
// eklenenler belli bile olmuyor"). Eski "Bu hafta" bölümünün iki soluk kartının yerine: her kartın
// kendi renkli başlık bandı (indigo = okul takvimi, zümrüt = yeni içerik), derslerin renkli
// etiketleri ve "YENİ" rozeti. Beyaz yazılı bantlar AA kontrastında (indigo-600 / emerald-700).
import Link from 'next/link';
import { CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import { SectionCard } from './SectionCard';

const LESSON_TINTS = [
  'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-200',
  'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  'bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200',
  'bg-teal-100 text-teal-900 dark:bg-teal-500/15 dark:text-teal-200',
  'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-500/15 dark:text-fuchsia-200',
];

// Aynı ders her yerde aynı renkte görünsün diye isimden türetilir.
function lessonTint(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return LESSON_TINTS[Math.abs(h) % LESSON_TINTS.length];
}

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

function CardShell({
  tone,
  icon,
  title,
  subtitle,
  labelledBy,
  children,
}: {
  tone: 'indigo' | 'emerald';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  return (
    <SectionCard tone={tone} icon={icon} title={title} subtitle={subtitle} headingId={labelledBy}>
      <ul className="divide-y divide-[var(--border)]">{children}</ul>
    </SectionCard>
  );
}

function Row({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = 'flex items-center gap-3 px-5 py-3';
  return (
    <li>
      {href ? (
        <Link href={href} className={`${cls} transition-colors hover:bg-surface`}>
          {children}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </li>
  );
}

export function SchoolThisWeekCard({ gradeName, week, topics }: { gradeName: string; week: number; topics: ThisWeekTopicItem[] }) {
  if (!topics.length) return null;
  return (
    <CardShell
      tone="indigo"
      labelledBy="okulda-bu-hafta"
      icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
      title="Okulda bu hafta"
      subtitle={`${gradeName} · ${week}. hafta · müfredat takvimine göre`}
    >
      {topics.map((t) => (
        <Row key={t.id} href={t.href}>
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${lessonTint(t.lessonName)}`}>{t.lessonName}</span>
            <span className="text-[15px] font-bold leading-snug text-default">{t.title}</span>
          </span>
        </Row>
      ))}
    </CardShell>
  );
}

export function RecentTopicsCard({ topics, gradeName }: { topics: RecentTopicItem[]; gradeName?: string | null }) {
  if (!topics.length) return null;
  return (
    <CardShell
      tone="emerald"
      labelledBy="yeni-eklenenler"
      icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
      title="Yeni eklenenler"
      subtitle={gradeName ? `${gradeName} · son eklenen konu anlatımları` : 'Son eklenen konu anlatımları'}
    >
      {topics.map((t) => {
        return (
          <Row key={t.id} href={t.href}>
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${lessonTint(t.lessonName)}`}>{t.lessonName}</span>
                {!gradeName && <span className="text-[11px] font-semibold text-muted-foreground">{t.gradeName}</span>}
              </span>
              <span className="text-[15px] font-bold leading-snug text-default">{t.title}</span>
            </span>
            {t.isNew ? (
              <span className="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-[11px] font-black uppercase text-amber-950">Yeni</span>
            ) : (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{dateFormatter.format(new Date(t.publishedAt))}</span>
            )}
          </Row>
        );
      })}
    </CardShell>
  );
}
