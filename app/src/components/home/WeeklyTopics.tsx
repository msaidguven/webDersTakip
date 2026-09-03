import Link from 'next/link';
import { CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import type { WeeklyTopicItem } from '@/app/src/lib/homeStats';

export function WeeklyTopics({
  topics,
  isAuthenticated,
}: {
  topics: WeeklyTopicItem[];
  isAuthenticated?: boolean;
}) {
  const isAuth = isAuthenticated ?? false;

  return (
    <div className="rounded-2xl border border-default bg-surface-elevated p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-black text-default">
          {isAuth ? (
            <>
              <CalendarDays className="h-5 w-5 text-orange-500" /> Haftanın Konuları
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-indigo-400" /> Son Eklenen Konular
            </>
          )}
        </h3>
        {!isAuth && (
          <Link
            href="#derslerimiz"
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Tümünü Gör <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isAuth
            ? 'Bu sınıf için bu hafta müfredatta planlanmış bir konu bulunmuyor.'
            : 'Bu sınıf için henüz konu eklenmemiş.'}
        </p>
      ) : (
        <ol className="space-y-1">
          {topics.map((topic, i) => {
            const row = (
              <>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                    isAuth ? 'bg-orange-500/10 text-orange-500' : 'bg-indigo-500/10 text-indigo-400'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-default">{topic.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{topic.lessonName}</p>
                </div>
                {topic.href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </>
            );
            const rowClassName = 'flex items-center gap-3 rounded-xl px-2 py-2 -mx-2';
            return topic.href ? (
              <li key={topic.id}>
                <Link href={topic.href} className={`${rowClassName} transition-colors hover:bg-surface`}>
                  {row}
                </Link>
              </li>
            ) : (
              <li key={topic.id} className={rowClassName}>
                {row}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
