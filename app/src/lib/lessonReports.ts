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

export interface UnitReport {
  key: string;
  title: string;
  totals: Totals;
  /** Ünitenin TÜM konuları (sorusu olmayanlar dahil — "Soruları hazırlanıyor"). */
  topics: TopicMastery[];
}

// Ünite ünite tamamlama ve başarı, müfredat sırasıyla. Sorusu olmayan ünite ve konular da listede kalır
// (raporda "yakında" yazar); başarı yalnız sorusu olan konulardan hesaplanır.
export function unitReports(lesson: LessonMastery): UnitReport[] {
  return lesson.units.map((u) => ({ key: u.key, title: u.title, totals: totalsOf(u.topics.filter((t) => t.total > 0)), topics: u.topics }));
}

// Renk tek başına anlam taşımaz (yanında yüzde yazar); eşikler topicMastery ile aynı.
export function accuracyTone(accuracy: number | null): 'good' | 'mid' | 'bad' | 'none' {
  if (accuracy == null) return 'none';
  if (accuracy >= MASTERY_RULES.learnedAccuracy * 100) return 'good';
  if (accuracy < MASTERY_RULES.weakAccuracy * 100) return 'bad';
  return 'mid';
}
