'use client';

// Soru bankası ders sayfasındaki (/soru-bankasi/[sinif]/[ders]) ünite kartları —
// kullanıcının 2026-09-06 verdiği eski tasarım referansına göre: sağda ünitenin
// (topic_contents.hero_image_url'den gelen) görseli, giriş yapmış kullanıcı için de
// altta bir ilerleme çubuğu var. Ünite başlığı/konu-soru sayısı/görsel SSR'dan (public,
// ISR-cache'lenebilir) geliyor; ilerleme SADECE giriş yapmış kullanıcı için anlamlı
// olduğundan client'ta ayrı isteklerle geliyor (bkz. SoruBankasiUnitTopicAnalytics.tsx'teki
// aynı desen — sayfanın geri kalanı statik kalsın diye). Mevcut /api/soru-bankasi/unit-status
// endpoint'i (TestStatusCard'ın kullandığı) her ünite için paralel çağrılıyor, yeni bir
// endpoint'e gerek kalmadı.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

interface UnitForList {
  id: number;
  title: string;
  slug: string;
  topicCount: number;
  questionCount: number;
  imageUrl: string | null;
}

interface UnitStatus {
  loggedIn: boolean;
  poolSize: number;
  solved: number;
}

export default function SoruBankasiLessonUnits({
  units,
  gradeSlug,
  lessonSlug,
}: {
  units: UnitForList[];
  gradeSlug: string;
  lessonSlug: string;
}) {
  const [statusByUnit, setStatusByUnit] = useState<Record<number, UnitStatus>>({});

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

  return (
    <div className="space-y-2.5">
      {units.map((unit) => {
        const status = statusByUnit[unit.id];
        const percent = status && status.poolSize > 0 ? Math.min(100, Math.round((status.solved / status.poolSize) * 100)) : 0;
        return (
          <Link
            key={unit.slug}
            href={`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unit.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-4 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-default">{unit.title}</p>
              {unit.questionCount === 0 ? (
                <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-500">Taslak</span>
              ) : (
                <span className="mt-1 inline-block text-xs font-bold text-muted-foreground">
                  {unit.topicCount} konu • {unit.questionCount} soru
                </span>
              )}

              {status?.loggedIn && status.solved > 0 && (
                <div className="mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
              {unit.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={unit.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        );
      })}
      {units.length === 0 && <p className="py-8 text-center text-sm font-medium text-muted-foreground">Bu derste henüz ünite eklenmemiş.</p>}
    </div>
  );
}
