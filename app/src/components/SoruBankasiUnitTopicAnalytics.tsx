'use client';

// Soru bankası ünite sayfasındaki "Konu Bazlı Analizler" bölümü — kullanıcının 2026-09-06
// verdiği tasarım referansına göre: her konu için küçük bir görsel + kendi soru/çözülen/
// doğru/yanlış rozetleriyle bir kart. Konu başlıkları/görselleri/soru sayıları SSR'dan
// (public, ISR-cache'lenebilir) geliyor; çözülen/doğru/yanlış SADECE giriş yapmış kullanıcı
// için anlamlı olduğundan client'ta ayrı bir istekle geliyor (bkz. TestStatusCard.tsx'teki
// aynı desen — sayfanın geri kalanı statik kalsın diye).
//
// ÖNEMLİ: üstte ünite geneli için 4 büyük istatistik kartı (Toplam Soru/Çözülen/Toplam
// Doğru/Toplam Yanlış) ARTIK YOK — sayfada hemen üstte zaten TestStatusCard ("Ünite Testi")
// AYNI toplamları gösteriyordu, ikisi yan yana birebir aynı 4 sayıyı iki kez basıyordu
// (2026-09-10 kullanıcı bildirimi — ekran görüntüsüyle). Tek kaynak TestStatusCard kaldı.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface TopicForAnalytics {
  id: number;
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

function MiniStat({ value, label, tone }: { value: number; label: string; tone?: 'emerald' | 'rose' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600' : tone === 'rose' ? 'text-rose-600' : 'text-default';
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-surface px-1.5 py-1.5">
      <span className={`text-sm font-black ${toneClass}`}>{value}</span>
      <span className="text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export default function SoruBankasiUnitTopicAnalytics({
  unitId,
  topics,
  gradeSlug,
  lessonSlug,
  unitSlug,
}: {
  unitId: number;
  topics: TopicForAnalytics[];
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}) {
  const [statsByTopic, setStatsByTopic] = useState<Record<number, TopicStatEntry> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const topicIds = topics.map((t) => t.id).join(',');
    fetch(`/api/soru-bankasi/unit-topic-status?unitId=${unitId}&topicIds=${topicIds}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { topics?: TopicStatEntry[] } | null) => {
        if (cancelled || !data?.topics) return;
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
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="mb-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground">Konu Bazlı Analizler</h2>
        <div className="space-y-2.5">
          {topics.map((topic, idx) => {
            const stat = statsByTopic?.[topic.id];
            return (
              <Link
                key={topic.id}
                href={`/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-default bg-surface-elevated p-3 transition-colors hover:border-indigo-400/50 hover:bg-indigo-500/5"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface">
                  {topic.heroImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={topic.heroImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Üniteler sayfasındaki "N. Ünite" ile aynı düzen (2026-09-10 kullanıcı
                      isteği) — topics zaten order_no sırasıyla geldiği için index doğrudan
                      müfredat sırasına denk düşüyor. */}
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{idx + 1}. Konu</p>
                  <p className="truncate text-sm font-black text-default">{topic.title}</p>
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                    <MiniStat value={stat?.poolSize ?? topic.questionCount} label="Soru" />
                    <MiniStat value={stat?.solved ?? 0} label="Çözülen" />
                    <MiniStat value={stat?.correct ?? 0} label="Doğru" tone="emerald" />
                    <MiniStat value={stat?.wrong ?? 0} label="Yanlış" tone="rose" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
