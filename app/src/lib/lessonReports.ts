// Ders raporları (İlerlemem, 2026-10-12 — Sınav Hazırlık projesindeki tasarımın ortaokul uyarlaması:
// https://claude.ai/artifact/BhprJ2kq1N4gouA6tRTmkH). Hepsi konu ustalığından (lib/topicMastery.ts,
// get_my_topic_mastery) türetilir; sınav ağırlığı / çıkmış soru gibi sınava özel veri yok. Kesin sayı,
// yorum/tahmin yok.
import { MASTERY_RULES, type LessonMastery, type TopicMastery } from '@/app/src/lib/topicMastery';

export function lessonHref(slug: string): string {
  return `/ilerlemem/${slug}`;
}

export interface Totals {
  solved: number;
  correct: number;
  total: number;
  /** null: değerlendirmeye yetecek soru yok (MASTERY_RULES.minSolvedToJudge). */
  accuracy: number | null;
}

export function totalsOf(topics: TopicMastery[]): Totals {
  const solved = topics.reduce((n, t) => n + t.solved, 0);
  const correct = topics.reduce((n, t) => n + t.correct, 0);
  const total = topics.reduce((n, t) => n + t.total, 0);
  return { solved, correct, total, accuracy: solved >= MASTERY_RULES.minSolvedToJudge ? Math.round((correct / solved) * 100) : null };
}

export interface PriorityTopic extends TopicMastery {
  lessonName: string;
  score: number;
}

// "Bu hafta önceliğin": başladığın ama henüz öğrenilmemiş konular, kaçırma oranına göre. Kaçırma oranı en
// az minSolvedToJudge soru çözülmüşse (1 − başarı oranı); daha azsa bilinmiyor → 0.5. Hiç başlanmamış
// konu öne çıkarılmaz (okulda henüz işlenmemiş olabilir — ortaokulda sınav ağırlığı yerine bu ölçüt).
export function priorityTopics(lessons: LessonMastery[], limit = 3): PriorityTopic[] {
  return lessons
    .flatMap((l) =>
      l.topics
        .filter((t) => t.state !== 'learned' && t.solved > 0 && t.href)
        .map((t) => ({
          ...t,
          lessonName: l.name,
          score: t.solved >= MASTERY_RULES.minSolvedToJudge ? 1 - t.correct / t.solved : 0.5,
        }))
    )
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.solved - b.solved)
    .slice(0, limit);
}

export interface UnitReport {
  key: string;
  title: string;
  totals: Totals;
  /** Ünitenin TÜM konuları (sorusu olmayanlar dahil — "Soruları hazırlanıyor"). */
  topics: TopicMastery[];
}

// Ünite ünite tamamlama ve başarı, müfredat sırasıyla (sorusu olmayan ünite yok sayılır).
export function unitReports(lesson: LessonMastery): UnitReport[] {
  return lesson.units
    .map((u) => ({ key: u.key, title: u.title, totals: totalsOf(u.topics.filter((t) => t.total > 0)), topics: u.topics }))
    .filter((u) => u.totals.total > 0);
}

// Renk tek başına anlam taşımaz (yanında yüzde yazar); eşikler topicMastery ile aynı.
export function accuracyTone(accuracy: number | null): 'good' | 'mid' | 'bad' | 'none' {
  if (accuracy == null) return 'none';
  if (accuracy >= MASTERY_RULES.learnedAccuracy * 100) return 'good';
  if (accuracy < MASTERY_RULES.weakAccuracy * 100) return 'bad';
  return 'mid';
}
