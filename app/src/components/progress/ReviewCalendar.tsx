'use client';

// Tekrar takvimi (İlerlemem, yol haritası 4g). Önümüzdeki 7 günde tekrar zamanı gelen soru
// sayıları (get_my_review_calendar RPC'si, Türkiye günü). "Bugün" gecikmişleri de içerir;
// buton yalnızca ŞU AN hazır olanları açan /tekrar'a gider — sayı farkı açıkça yazılır.
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';

interface CalendarDay {
  day: string; // YYYY-MM-DD
  due_count: number;
  ready_now: number;
}

const WEEKDAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', timeZone: 'UTC' });

function dayLabel(day: string, index: number): string {
  if (index === 0) return 'Bugün';
  if (index === 1) return 'Yarın';
  const [y, m, d] = day.split('-').map(Number);
  const name = WEEKDAY.format(new Date(Date.UTC(y, m - 1, d)));
  return name.charAt(0).toLocaleUpperCase('tr-TR') + name.slice(1);
}

export function ReviewCalendar() {
  const { user, supabase } = useAuth();
  const { data, error } = useSWR<CalendarDay[]>(
    user ? ['review-calendar', user.id] : null,
    async () => {
      const { data: rows, error: rpcError } = await supabase.rpc('get_my_review_calendar', { p_days: 7 });
      if (rpcError) throw rpcError;
      return (rows as CalendarDay[] | null) ?? [];
    },
    { revalidateOnFocus: false }
  );

  if (error) return null;

  const max = Math.max(1, ...(data ?? []).map((d) => d.due_count));
  const today = data?.[0];
  const readyNow = today?.ready_now ?? 0;
  const total = (data ?? []).reduce((sum, d) => sum + d.due_count, 0);
  const next = data?.slice(1).find((d) => d.due_count > 0);
  const nextIndex = next && data ? data.indexOf(next) : -1;

  return (
    <section aria-labelledby="tekrar-takvimi" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="tekrar-takvimi" className="text-lg font-extrabold text-default sm:text-xl">
          Tekrar takvimi
        </h2>
        <p className="text-sm text-muted-foreground">Unutmaman için soruların tekrar günleri. Önümüzdeki 7 gün.</p>
      </div>

      {!data ? (
        <div aria-busy="true" aria-label="Takvim yükleniyor" className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : total === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">
          Önümüzdeki 7 günde tekrar edilecek soru yok. Soru çözdükçe tekrarların burada planlanır.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {data.map((d, i) => (
              <li key={d.day} className="grid grid-cols-[88px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[104px_minmax(0,1fr)_72px]">
                <span className={`text-sm ${i === 0 ? 'font-black text-indigo-700 dark:text-indigo-300' : 'font-semibold text-muted-foreground'}`}>
                  {dayLabel(d.day, i)}
                </span>
                <span className="block h-2.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${i === 0 ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-300 dark:bg-indigo-500/60'}`}
                    style={{ width: `${Math.round((d.due_count / max) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-sm font-bold text-default">{d.due_count ? `${d.due_count} soru` : '—'}</span>
              </li>
            ))}
          </ul>

          {readyNow > 0 ? (
            <div className="flex flex-col gap-2">
              <Link
                href="/tekrar"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-[15px] font-extrabold text-white transition-colors hover:bg-indigo-700"
              >
                Tekrara başla · {readyNow} soru hazır
              </Link>
              {today && today.due_count > readyNow && (
                <p className="text-center text-[13px] text-muted-foreground">
                  Bugünkü {today.due_count - readyNow} soru gün içinde hazır olacak.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-2xl bg-surface p-3 text-center text-[13px] text-muted-foreground">
              {today && today.due_count > 0
                ? `Bugünkü ${today.due_count} soru gün içinde hazır olacak.`
                : next
                  ? `Şu an hazır tekrar yok. Sıradaki: ${dayLabel(next.day, nextIndex)} ${next.due_count} soru.`
                  : 'Şu an hazır tekrar yok.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
