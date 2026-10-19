// Konu sayfasının (DersClient.tsx) paylaştığı tipler + saf yardımcı fonksiyonlar/sabitler.
// Hiçbiri component state'ine kapanmıyor — DersClient'ın 2800+ satırını okunur tutmak için
// buraya ayrıldı (kullanıcının 2026-09-05 isteği: "bunu ayrı componentler haline getirsen
// daha kolay olmaz mı").

import { slugifyHeading } from '@/app/src/lib/site';
import type { CurriculumBreak } from '@/app/src/lib/routeParsing';
import type { WeekRange } from '@/app/src/lib/kazanimPlan';

export type Outcome = {
  id?: string | number;
  description: string;
  topicId?: string | number | null;
  code?: string | null;
  learningOutcomeId?: number | null;
  learningOutcome?: { id: number; code: string | null; title: string } | null;
  // Kazanımın işleneceği öğretim haftaları (outcome_weeks); atanmamışsa boş/yok.
  weekRanges?: WeekRange[];
};
export type TopicSection = {
  id: string | number;
  heading: string;
  html: string | null;
  notebookHtml?: string | null;
  // Bundan sonra üretilen içerikte notebookHtml'in yerini alan "Düşün/Hayal Et/Dene"
  // etkinlik kutusu — bkz. SectionContent.tsx.
  activityPromptHtml?: string | null;
  activityExampleHtml?: string | null;
  imageUrl: string | null;
  imagePrompt: string | null;
  imageAlt?: string | null;
  diagramSvg?: string | null;
  // Opsiyonel, alt başlık başına kısa video — görsel/diyagram ile aynı desende, AI karar
  // verip video_prompt yazıyor, admin harici üretip/bulup video_url'i bağlıyor (bkz.
  // AdminTopicSectionsPanel: VideoModal/VideoSuggestionsModal, kullanıcının 2026-09-16 isteği).
  videoUrl?: string | null;
  videoPrompt?: string | null;
  videoType?: 'ai_generated' | 'youtube' | null;
};
export type TopicHighlight = { icon: string | null; title: string; description: string };
export type Content = {
  id: string | number;
  title: string;
  slug?: string | null;
  content?: string | null;
  sections?: TopicSection[];
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  subtitle?: string | null;
  // Konu sonunda gösterilen tek toplu "Konu Özeti" — bkz. DersClient.tsx render'ı.
  summaryHtml?: string | null;
  // Konu sonundaki "Düşün ve Yorumla" kapanış sorusu — var olan tartışma bölümüne bağlanır.
  discussionPromptHtml?: string | null;
  highlights?: TopicHighlight[];
  // false ise bu konunun sections/highlights alanları henüz sunucudan çekilmedi (sadece
  // başlık/slug var) — bkz. DersClient.tsx: ensureTopicContentLoaded.
  contentLoaded?: boolean;
  // Konu artık güncel müfredatta değil ama sayfası hâlâ canlı — bkz. topics.is_archived,
  // DersClient.tsx'teki arşiv uyarı kutusu.
  isArchived?: boolean;
  // "Video / Sesli Anlatım" hazır mı — bkz. lessonWeekData.ts / topic_narrations.
  hasNarration?: boolean;
};
export type Unit = { id: number; title: string; slug: string | null; order_no: number; start_week: number | null; end_week: number | null; is_active?: boolean; has_questions?: boolean; test_question_count?: number };
export type ProfileRoleRow = { role: string | null };
export type GradeLesson = { id: number; name: string; slug: string | null; icon: string | null };
export type GradeOption = { id: number; name: string; slug: string | null };

export type { CurriculumBreak };

// Bir konunun alt başlıklarına (section) başlıktan türetilen, benzersiz, URL-güvenli
// anchor slug'ları üretir. Aynı başlık iki kez geçerse -2, -3... ile ayrıştırılır.
export function buildSectionSlugs(sections: TopicSection[]): Map<string | number, string> {
  const used = new Map<string, number>();
  const bySectionId = new Map<string | number, string>();
  sections.forEach((section) => {
    const base = slugifyHeading(section.heading) || 'alt-baslik';
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    bySectionId.set(section.id, count === 0 ? base : `${base}-${count + 1}`);
  });
  return bySectionId;
}

export function buildTopicHref(gradeSlug: string | null, lessonSlug: string | null, unitSlug: string | null, topicSlug: string | null) {
  if (!gradeSlug || !lessonSlug || !unitSlug || !topicSlug) return null;
  return `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`;
}

// Kısa ve SEO'ya uygun tutmak için ünite adını (en az ayırt edici, en tekrarcı kısım)
// ve dolgu kelimelerini ("dersi", "ünitesinde", "konusunu anlatan") atlıyoruz. AI, görsel
// üretilirken görselin GERÇEKTE ne içerdiğine dair kısa bir alt metin de üretiyor
// (customAlt) — varsa onu tercih ediyoruz, çünkü sadece müfredat metadata'sını
// tekrarlamak yerine görselin içeriğini anlatıyor; yoksa (eski görseller) bu kalıba düşüyoruz.
export function buildTopicImageAlt(topicTitle: string, lessonName: string, gradeName: string, customAlt?: string | null) {
  if (customAlt?.trim()) return `${gradeName} ${lessonName} ${customAlt.trim()}`;
  return `${gradeName} ${lessonName} ${topicTitle} görseli`;
}

export function buildSectionImageAlt(sectionHeading: string, topicTitle: string, lessonName: string, gradeName: string, customAlt?: string | null) {
  if (customAlt?.trim()) return `${gradeName} ${lessonName} ${customAlt.trim()}`;
  return `${gradeName} ${lessonName} ${topicTitle}: ${sectionHeading} görseli`;
}
