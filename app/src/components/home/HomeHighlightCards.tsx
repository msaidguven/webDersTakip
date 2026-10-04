// Anasayfa vurgu kartları (v4 sade tasarım, 2026-10-02 — kullanıcı onaylı prototip
// ~/İndirilenler/ders_takip_anasayfa_v4_sade.html). Renkli bantlar kaldırıldı: beyaz kart, ince
// çerçeve, ders rengi yalnız küçük nokta/ikonda, "Yeni" ve "3. hafta" açık mor küçük etiket.
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import { SubjectIcon } from './SubjectIcon';

const titleCls = 'block font-medium leading-snug text-default transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400';

// 2026-10-03: mobilde sade beyaz kart gözden kaçıyordu (kullanıcı isteği) → açık indigo zemin,
// dolgulu takvim ikonu, dolgulu hafta etiketi; konular ders ikonlu beyaz satır kartları.
export function SchoolThisWeekCard({ gradeName, week, topics }: { gradeName: string; week: number; topics: ThisWeekTopicItem[] }) {
  if (!topics.length) return null;
  return (
    <section
      aria-labelledby="okulda-bu-hafta"
      className="rounded-[20px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 shadow-[0_10px_28px_-18px_rgba(79,70,229,0.55)] sm:p-5 dark:border-indigo-500/30 dark:from-indigo-500/15 dark:to-violet-500/10"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white" aria-hidden="true">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 id="okulda-bu-hafta" className="font-bold text-default">
              Okulda bu hafta
            </h2>
            <span className="shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">{week}. hafta</span>
          </div>
          <p className="text-xs text-muted-foreground">{gradeName} · müfredat takvimine göre</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {topics.map((t) => {
          const body = (
            <>
              {t.imageUrl ? (
                // Konu görseli varsa ikon yerine o (2026-10-03, kullanıcı isteği). Ekranın üstünde değil → lazy.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.imageUrl} alt="" loading="lazy" decoding="async" className="h-12 w-16 shrink-0 rounded-lg bg-surface-elevated object-cover" />
              ) : (
                // Görselsiz konu: aynı boyutta ders renginde kutu — başlıklar hizalı kalsın.
                <span className={`flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border ${subjectStyle(t.lessonName).tint}`} aria-hidden="true">
                  <SubjectIcon lessonName={t.lessonName} size="sm" variant="solid" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`${titleCls} text-[15px]`}>{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.lessonName}</span>
              </span>
              {t.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </>
          );
          const cls = 'group flex items-center gap-3 rounded-xl border border-indigo-100 bg-background px-3 py-2.5 shadow-sm dark:border-indigo-500/20';
          return (
            <li key={t.id}>
              {t.href ? (
                <Link href={t.href} className={`${cls} transition-colors hover:border-indigo-300 dark:hover:border-indigo-400/50`}>
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

// Yeni eklenenler (2026-10-02, referans tasarımın kapak görselli konu kartları): görsel varsa kapak,
// yoksa dersin açık renginde zemin + dolgulu ikon. Görseller sayfanın aşağısında → lazy, hızı etkilemez.
const NEW_BADGE_MS = 3 * 86_400_000;
const noopSubscribe = () => () => {};

// "Yeni" rozeti istemcide hesaplanır (2026-10-04): sayfa haftada bir üretildiği için sunucudaki
// isNew bir hafta boyunca donuk kalırdı. Sunucu/ilk render snapshot'ı t.isNew → hydration uyumlu.
function useIsNew(publishedAt: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => Date.now() - Date.parse(publishedAt) < NEW_BADGE_MS,
    () => serverValue,
  );
}

function NewBadge({ publishedAt, serverValue }: { publishedAt: string; serverValue: boolean }) {
  if (!useIsNew(publishedAt, serverValue)) return null;
  return <span className="absolute left-2 top-2 rounded-md bg-background/95 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 shadow-sm dark:text-indigo-300">Yeni</span>;
}

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
                <NewBadge publishedAt={t.publishedAt} serverValue={t.isNew} />
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
