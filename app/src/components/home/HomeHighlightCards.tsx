// Anasayfa (girişli) vurgu kartları. Renk ve efektler misafir anasayfası (GuestHomeV1) ile aynı
// sistem (2026-10-19): mavi→camgöbeği gradyan, beyaz çerçeve + hafif mavi ton, hover'da kalkma +
// mavi gölge. Ders rengi yalnız ikonda.
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type { RecentTopicItem, ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import { SubjectIcon } from './SubjectIcon';
import r from '../robotic/robotic.module.css';

const titleCls = 'block font-medium leading-snug text-default';

export function SchoolThisWeekCard({ gradeName, week, topics }: { gradeName: string; week: number; topics: ThisWeekTopicItem[] }) {
  if (!topics.length) return null;
  return (
    <section
      aria-labelledby="okulda-bu-hafta"
      className={`rounded-[20px] p-4 sm:p-5 ${r.panel}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-11 w-11 shrink-0 ${r.chipBox}`} aria-hidden="true">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 id="okulda-bu-hafta" className="font-bold text-default">
              Okulda bu hafta
            </h2>
            <span className={`shrink-0 ${r.badge}`}>{week}. hafta</span>
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
              {t.href && <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${r.accent}`} aria-hidden="true" />}
            </>
          );
          const cls = `group flex items-center gap-3 rounded-xl px-3 py-2.5 ${r.item}`;
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
  return <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${r.btnNeon}`}>Yeni</span>;
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
                <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-default">
                  {t.title}
                </span>
                <span className="mt-auto truncate text-xs text-muted-foreground">{gradeName ? t.lessonName : `${t.gradeName} · ${t.lessonName}`}</span>
              </span>
            </>
          );
          const cls = `group relative flex h-full flex-col overflow-hidden rounded-2xl hover:-translate-y-0.5 ${r.item}`;
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
