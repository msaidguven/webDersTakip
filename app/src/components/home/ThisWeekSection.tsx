// "Bu hafta" (2026-09-27): Okulda bu hafta (müfredat takvimine göre, seçili sınıf) + Yeni
// eklenenler (tüm sınıflar). Takvim verisi olmayan sınıfta "Okulda bu hafta" kartı hiç
// gösterilmez — takvime bakmadan "bu hafta" demek yanlış bir iddia olurdu (bkz.
// homeHighlights.getThisWeekTopicsByGrade). Son yorumlar BİLİNÇLİ olarak yok: reşit olmayan
// öğrencilerin içeriğini anasayfa vitrinine taşımak moderasyon/KVKK riski.
import Link from 'next/link';
import { CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });

function Row({ href, title, meta, trailing }: { href: string | null; title: string; meta: string; trailing: React.ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug text-default">{title}</span>
        <span className="text-[13px] text-muted-foreground">{meta}</span>
      </span>
      {trailing}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3.5">{body}</div>
      )}
    </li>
  );
}

function Card({ icon, iconClass, title, subtitle, children }: { icon: React.ReactNode; iconClass: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-default bg-background">
      <div className="flex items-center gap-3 px-5 pb-3.5 pt-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>{icon}</span>
        <span>
          <span className="block text-base font-black text-default">{title}</span>
          <span className="text-[13px] text-muted-foreground">{subtitle}</span>
        </span>
      </div>
      <ul className="divide-y divide-[var(--border)] border-t border-default">{children}</ul>
    </div>
  );
}

export function ThisWeekSection({
  gradeName,
  thisWeek,
  recent,
}: {
  gradeName: string;
  thisWeek: ThisWeekTopicItem[];
  recent: RecentTopicItem[];
}) {
  if (!thisWeek.length && !recent.length) return null;
  const chevron = <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;

  return (
    <section aria-labelledby="bu-hafta" className="flex flex-col gap-5">
      <div>
        <h2 id="bu-hafta" className="text-2xl font-black tracking-tight text-default sm:text-3xl">
          Bu hafta
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {thisWeek.length ? 'Okulda işlenen konular ve siteye yeni eklenenler.' : 'Siteye yeni eklenen konu anlatımları.'}
        </p>
      </div>
      <div className={`grid grid-cols-1 items-start gap-4 ${thisWeek.length && recent.length ? 'lg:grid-cols-2' : ''}`}>
        {thisWeek.length > 0 && (
          <Card
            icon={<CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />}
            iconClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            title="Okulda bu hafta"
            subtitle={`${gradeName} · müfredat takvimine göre`}
          >
            {thisWeek.map((t) => (
              <Row key={t.id} href={t.href} title={t.title} meta={t.lessonName} trailing={chevron} />
            ))}
          </Card>
        )}
        {recent.length > 0 && (
          <Card
            icon={<Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />}
            iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            title="Yeni eklenenler"
            subtitle="Konu anlatımı yayınlandı"
          >
            {recent.map((t) => (
              <Row
                key={t.id}
                href={t.href}
                title={t.title}
                meta={`${t.gradeName} · ${t.lessonName}`}
                trailing={
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {dateFormatter.format(new Date(t.publishedAt))}
                  </span>
                }
              />
            ))}
          </Card>
        )}
      </div>
    </section>
  );
}
