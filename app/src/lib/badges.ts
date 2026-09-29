// Rozetler (İlerlemem, yol haritası 4i — 2026-09-29). Yalnızca GERİ ALINAMAYAN ölçülerden
// türetilir: toplam çözülen soru, en uzun seri, çalışılan gün sayısı — hepsi zamanla sadece
// artar. Ustalık ("konu öğrendin") bilinçli olarak rozet DEĞİL: konu başarısı düşerse rozet
// kaybolurdu (çocuk için kötü deneyim); o bilgi konu haritasında. Ayrı bir tablo gerekmez.
import { addDays, istanbulToday, summarizeActivity, type DailyActivity, type ProgressSummary } from './progressActivity';

export type BadgeIcon = 'first' | 'questions' | 'streak' | 'days';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: BadgeIcon;
  earned: boolean;
  progress: number; // 0-100, kazanılmamışlar için
  progressLabel: string; // "312 / 500"
  remainingLabel: string; // "188 soru" (kazanılmamışlar için)
}

type Metric = 'totalAnswered' | 'longestStreak' | 'activeDays';

const DEFINITIONS: { id: string; title: string; description: string; icon: BadgeIcon; metric: Metric; target: number; unit: string }[] = [
  { id: 'first-question', title: 'İlk adım', description: 'İlk sorunu çözdün', icon: 'first', metric: 'totalAnswered', target: 1, unit: 'soru' },
  { id: 'questions-100', title: '100 soru', description: 'Toplam 100 soru çözdün', icon: 'questions', metric: 'totalAnswered', target: 100, unit: 'soru' },
  { id: 'questions-500', title: '500 soru', description: 'Toplam 500 soru çözdün', icon: 'questions', metric: 'totalAnswered', target: 500, unit: 'soru' },
  { id: 'questions-1000', title: '1000 soru', description: 'Toplam 1000 soru çözdün', icon: 'questions', metric: 'totalAnswered', target: 1000, unit: 'soru' },
  { id: 'streak-3', title: '3 günlük seri', description: '3 gün üst üste çalıştın', icon: 'streak', metric: 'longestStreak', target: 3, unit: 'gün' },
  { id: 'streak-7', title: '7 günlük seri', description: '7 gün üst üste çalıştın', icon: 'streak', metric: 'longestStreak', target: 7, unit: 'gün' },
  { id: 'streak-30', title: '30 günlük seri', description: '30 gün üst üste çalıştın', icon: 'streak', metric: 'longestStreak', target: 30, unit: 'gün' },
  { id: 'days-30', title: '30 gün', description: 'Toplam 30 farklı gün çalıştın', icon: 'days', metric: 'activeDays', target: 30, unit: 'gün' },
];

export function computeBadges(summary: ProgressSummary): Badge[] {
  return DEFINITIONS.map((d) => {
    const value = summary[d.metric];
    const earned = value >= d.target;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      icon: d.icon,
      earned,
      progress: earned ? 100 : Math.floor((value / d.target) * 100),
      progressLabel: `${Math.min(value, d.target)} / ${d.target} ${d.unit}`,
      remainingLabel: `${Math.max(0, d.target - value)} ${d.unit}`,
    };
  });
}

// Özet kartındaki tek satır (2026-09-29): tüm ızgara sayfanın altında; üstte sadece motive eden
// tek bilgi. Son 7 günde kazanılan rozet varsa o (en değerlisi = tanım sırasında en sondaki),
// yoksa kazanılmamışlar içinde hedefe EN YAKIN olan. "Son 7 günde kazanıldı" ayrı kayıt
// tutmadan: bir hafta önceki veriyle hesaplanan rozetlerle karşılaştırılır (ölçüler geri
// alınamaz olduğu için güvenilir).
export type BadgeHighlight = { kind: 'recent'; badge: Badge } | { kind: 'next'; badge: Badge } | null;

export function badgeHighlight(rows: DailyActivity[], today: string = istanbulToday()): BadgeHighlight {
  const now = computeBadges(summarizeActivity(rows, today));
  const weekAgoDay = addDays(today, -7);
  const weekAgo = computeBadges(summarizeActivity(rows.filter((r) => r.day <= weekAgoDay), weekAgoDay));
  const earnedBefore = new Set(weekAgo.filter((b) => b.earned).map((b) => b.id));
  const recent = now.filter((b) => b.earned && !earnedBefore.has(b.id)).pop();
  if (recent) return { kind: 'recent', badge: recent };
  const next = now.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress)[0];
  return next ? { kind: 'next', badge: next } : null;
}
