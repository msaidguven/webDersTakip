'use client';

// Soru bankası ünite sayfasındaki konu listesi (2026-10-03 yenilemesi; eski "Konu Bazlı
// Analizler" kartları). Her konu tek satır: sıra, görsel (yoksa ders renginde ikon), başlık,
// soru sayısı → konunun soru bankası sayfası. Başlık/görsel/soru sayısı SSR'dan (ISR'a uygun);
// öğrencinin ilerlemesi client'ta ayrı istekle gelir ve YALNIZ giriş yapmış kullanıcıya
// gösterilir — misafire "0 doğru · 0 yanlış · %0" gösterilmez (eski kartların yarısı buydu).
// Ünite toplamı TestStatusCard'da; burada tekrar edilmez.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { NeonSubjectIcon } from './robotic/NeonSubjectIcon';
import { NeonCount } from './robotic/NeonCount';
import { hasClientSession } from '@/app/src/lib/clientSession';
import r from './robotic/robotic.module.css';

interface TopicForList {
  id: number;
  number: number;
  title: string;
  slug: string;
  questionCount: number;
  heroImageUrl: string | null;
}

interface TopicStatEntry {
  topicId: number;
  poolSize: number;
  solved: number;
  correct: number;
  wrong: number;
}

export default function SoruBankasiUnitTopicAnalytics({
  unitId,
  topics,
  lessonName,
  gradeSlug,
  lessonSlug,
  unitSlug,
}: {
  unitId: number;
  topics: TopicForList[];
  lessonName: string;
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}) {
  const [statsByTopic, setStatsByTopic] = useState<Record<number, TopicStatEntry> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const topicIds = topics.map((t) => t.id).join(',');
    // Yalnız girişli kullanıcıya kişisel istatistik gösteriliyor (misafir yanıtı kullanılmıyordu) —
    // misafirde hiç istek atılmaz (2026-10-04, Vercel CPU).
    hasClientSession()
      .then((loggedIn) => (loggedIn ? fetch(`/api/soru-bankasi/unit-topic-status?unitId=${unitId}&topicIds=${topicIds}`) : null))
      .then((res) => (res?.ok ? res.json() : null))
      .then((data: { loggedIn?: boolean; topics?: TopicStatEntry[] } | null) => {
        if (cancelled || !data?.loggedIn || !data.topics) return;
        const map: Record<number, TopicStatEntry> = {};
        for (const t of data.topics) map[t.topicId] = t;
        setStatsByTopic(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  return (
    <ol className="flex flex-col gap-3">
      {topics.map((topic) => {
        const stat = statsByTopic?.[topic.id];
        const total = stat?.poolSize || topic.questionCount;
        const pct = stat && total ? Math.min(100, Math.round((stat.solved / total) * 100)) : 0;
        if (topic.questionCount === 0) {
          return (
            <li key={topic.id} className={`flex items-center gap-4 rounded-[20px] ${r.panel} p-3 opacity-70 sm:p-4`}>
              {topic.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={topic.heroImageUrl} alt="" loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-xl bg-surface-elevated object-cover sm:h-20 sm:w-32" />
              ) : (
                <NeonSubjectIcon lessonName={lessonName} className="h-16 w-24 sm:h-20 sm:w-32" iconClassName="h-7 w-7" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`text-xs font-semibold ${r.accent}`}>{topic.number}. konu</span>
                <span className={`mt-0.5 block font-bold leading-snug text-default ${r.display}`}>{topic.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">Sorular yakında eklenecek</span>
              </span>
            </li>
          );
        }
        return (
          <li key={topic.id}>
            <Link
              href={`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
              className={`group flex items-center gap-4 rounded-[20px] ${r.panel} p-3 transition-all ${r.itemHover} hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)] sm:p-4`}
            >
              {topic.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={topic.heroImageUrl} alt="" loading="lazy" decoding="async" className="h-16 w-24 shrink-0 rounded-xl bg-surface-elevated object-cover sm:h-20 sm:w-32" />
              ) : (
                <NeonSubjectIcon lessonName={lessonName} className="h-16 w-24 sm:h-20 sm:w-32" iconClassName="h-7 w-7" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`text-xs font-semibold ${r.accent}`}>{topic.number}. konu</span>
                <span className={`mt-0.5 block font-bold leading-snug text-default transition-colors ${r.display} ${r.groupHoverAccent}`}>{topic.title}</span>
                {stat && stat.solved > 0 ? (
                  <span className="mt-2 block">
                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        <span className="font-semibold text-default">{stat.solved}/{total}</span> soru çözüldü
                      </span>
                      <span>%{Math.round((stat.correct / stat.solved) * 100)} başarı</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-hidden="true">
                      <span className={`block h-full rounded-full ${r.btnNeon}`} style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                ) : (
                  <span className="mt-1.5 block">
                    <NeonCount value={topic.questionCount} unit="soru" />
                  </span>
                )}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
