'use client';

// Soru bankası ders sayfasındaki (/soru-bankasi/[sinif]/[ders]) ünite kartları (2026-10-03
// yenilemesi): görsel + "N. ünite" + başlık + konu/soru sayısı, kartın altında ünitenin konuları
// (her biri kendi soru bankası sayfasına) — öğrenciye kısayol, Google'a iç bağlantı.
// Başlık/sayılar/görsel SSR'dan (ISR'a uygun); ilerleme YALNIZ giriş yapmış kullanıcıya, client'ta
// mevcut /api/soru-bankasi/unit-status ile (TestStatusCard'ın kullandığı) ünite başına paralel.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
import { subjectStyle } from '@/app/src/lib/subjectStyle';

interface UnitForList {
  id: number;
  number: number;
  title: string;
  slug: string;
  questionCount: number;
  imageUrl: string | null;
  topics: { id: number; number: number; title: string; slug: string; questionCount: number }[];
}

interface UnitStatus {
  loggedIn: boolean;
  poolSize: number;
  solved: number;
  correct: number;
  wrong: number;
}

export default function SoruBankasiLessonUnits({
  units,
  lessonName,
  gradeSlug,
  lessonSlug,
}: {
  units: UnitForList[];
  lessonName: string;
  gradeSlug: string;
  lessonSlug: string;
}) {
  const [statusByUnit, setStatusByUnit] = useState<Record<number, UnitStatus>>({});
  const tint = subjectStyle(lessonName).tint;

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      units.map((unit) =>
        fetch(`/api/soru-bankasi/unit-status?unitId=${unit.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: UnitStatus | null) => (data ? ([unit.id, data] as const) : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<number, UnitStatus> = {};
      for (const entry of results) {
        if (entry) map[entry[0]] = entry[1];
      }
      setStatusByUnit(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeSlug, lessonSlug]);

  if (!units.length) return <p className="py-8 text-center text-sm text-muted-foreground">Bu derste henüz ünite eklenmemiş.</p>;

  return (
    <ol className="flex flex-col gap-4">
      {units.map((unit) => {
        const unitHref = `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unit.slug}`;
        const status = statusByUnit[unit.id];
        const showProgress = status?.loggedIn && status.solved > 0;
        const percent = status && status.poolSize > 0 ? Math.min(100, Math.round((status.solved / status.poolSize) * 100)) : 0;
        return (
          <li key={unit.slug} className="overflow-hidden rounded-[20px] border border-default bg-background">
            <Link href={unitHref} className="group flex items-center gap-4 p-3 transition-colors hover:bg-surface-elevated/60 sm:p-4">
              {unit.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={unit.imageUrl} alt="" loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-xl bg-surface-elevated object-cover sm:h-20 sm:w-32" />
              ) : (
                <span className={`flex h-16 w-24 shrink-0 items-center justify-center rounded-xl border sm:h-20 sm:w-32 ${tint}`} aria-hidden="true">
                  <SubjectIcon lessonName={lessonName} variant="solid" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{unit.number}. ünite</span>
                <span className="mt-0.5 block text-lg font-bold leading-snug text-default transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{unit.title}</span>
                {showProgress ? (
                  <span className="mt-2 block">
                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        <span className="font-semibold text-default">{status.solved}/{status.poolSize}</span> soru çözüldü
                      </span>
                      <span>%{Math.round((status.correct / status.solved) * 100)} başarı</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                      <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                ) : (
                  <span className="mt-1 block text-sm text-muted-foreground">{unit.topics.length} konu · {unit.questionCount} soru</span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {unit.topics.length > 0 && (
              <ul className="divide-y divide-[var(--border)] border-t border-default" aria-label={`${unit.title} konuları`}>
                {unit.topics.map((topic) => (
                  <li key={topic.id}>
                    <Link href={`${unitHref}/${topic.slug}`} className="group flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-elevated/60">
                      <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">{topic.number}.</span>
                      <span className="min-w-0 flex-1 font-medium text-default group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{topic.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{topic.questionCount} soru</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
