'use client';

// Anasayfa "Yaklaşan yazılılar" kartı (2026-10-21). Sayfa ISR'da haftalarca kalabildiği için geçmiş
// sınavları ayıklamak ve gün saymak tarayıcıda yapılır; hiç yaklaşan yazılı yoksa kart görünmez.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import { daysUntil, formatExamDate } from '@/app/src/components/yazili/ExamCountdown';
import r from '@/app/src/components/robotic/robotic.module.css';

export type UpcomingExam = { id: number; title: string; path: string; examDate: string };

const MAX_SHOWN = 4;

export function UpcomingExamsCard({ exams, className = '' }: { exams: UpcomingExam[]; className?: string }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(istanbulToday());
  }, []);
  if (!today) return null;
  const upcoming = exams
    .map((e) => ({ ...e, days: daysUntil(e.examDate, today) }))
    .filter((e) => e.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, MAX_SHOWN);
  if (!upcoming.length) return null;

  return (
    <section aria-labelledby="yaklasan-yazililar" className={`flex flex-col gap-3 p-5 ${r.panel} ${className}`}>
      <h2 id="yaklasan-yazililar" className="flex items-center gap-2 text-base font-black text-default">
        <CalendarClock className={`h-5 w-5 ${r.accent}`} aria-hidden="true" />
        Yaklaşan yazılılar
      </h2>
      <ul className="flex flex-col gap-2">
        {upcoming.map((e) => (
          <li key={e.id}>
            <Link href={e.path} className={`flex items-center gap-3 rounded-2xl p-3 ${r.item} ${r.itemHover}`}>
              <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center leading-none ${r.chipBox}`} aria-hidden="true">
                <b className="text-base">{e.days}</b>
                <span className="text-[10px]">gün</span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-default">{e.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatExamDate(e.examDate)} · {e.days === 0 ? 'bugün' : `${e.days} gün kaldı`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/yazili-sorulari" className={`w-fit text-sm font-semibold hover:underline ${r.accent}`}>
        Tüm yazılı soruları →
      </Link>
    </section>
  );
}
