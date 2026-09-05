// Konu sayfasının (DersClient.tsx) paylaştığı tipler + saf yardımcı fonksiyonlar/sabitler.
// Hiçbiri component state'ine kapanmıyor — DersClient'ın 2800+ satırını okunur tutmak için
// buraya ayrıldı (kullanıcının 2026-09-05 isteği: "bunu ayrı componentler haline getirsen
// daha kolay olmaz mı").

import { slugifyHeading } from '@/app/src/lib/site';
import type { CurriculumBreak } from '@/app/src/lib/routeParsing';

export type Outcome = { id?: string | number; description: string; topicId?: string | number | null };
export type WeekedOutcome = Outcome & {
  startWeek: number | null;
  endWeek: number | null;
  code: string | null;
  previewCode: string;
};
export type SpecialWeekEvent = {
  id: number;
  eventType: 'break' | 'special_content' | 'social_activity';
  title: string;
  subtitle: string | null;
  contentHtml: string | null;
  curriculumWeek: number | null;
  startDate: string | null;
  endDate: string | null;
};
export type TopicSection = { id: string | number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null; imageAlt?: string | null; diagramSvg?: string | null };
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
  highlights?: TopicHighlight[];
  // false ise bu konunun sections/highlights alanları henüz sunucudan çekilmedi (sadece
  // başlık/slug var) — bkz. DersClient.tsx: ensureTopicContentLoaded.
  contentLoaded?: boolean;
};
export type Unit = { id: number; title: string; slug: string | null; order_no: number; start_week: number | null; end_week: number | null; is_active?: boolean; has_questions?: boolean; test_question_count?: number };
export type ProfileRoleRow = { role: string | null };
export type GradeLesson = { id: number; name: string; slug: string | null; icon: string | null };

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

// Genel amaçlı, TTL'li localStorage önbelleği. Herhangi bir veri için (sadece
// ünite konuları değil) sayfa açılışını yavaşlatmadan arkaplanda önceden
// yükleyip birkaç gün boyunca saklamak istediğimizde tekrar kullanılabilir.
export function readPersistentCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; savedAt: number };
    if (!parsed || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePersistentCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage dolu/erişilemez olabilir; sessizce yoksay, sadece bellek içi önbellek kullanılır
  }
}

export const UNIT_TOPICS_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 gün

export function unitTopicsCacheKey(gradeId: string, lessonId: string, unitId: number | string) {
  return `ders-unit-topics:${gradeId}:${lessonId}:${unitId}`;
}

export function buildTopicHref(gradeSlug: string | null, lessonSlug: string | null, unitSlug: string | null, topicSlug: string | null) {
  if (!gradeSlug || !lessonSlug || !unitSlug || !topicSlug) return null;
  return `/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`;
}

export function buildTopicTestHref(gradeSlug: string | null, lessonSlug: string | null, unitSlug: string | null, topicSlug: string | null) {
  const topicHref = buildTopicHref(gradeSlug, lessonSlug, unitSlug, topicSlug);
  if (!topicHref) return null;
  return `${topicHref}/kavrama-testi`;
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

// Kazanımlar müfredat yılı içinde neredeyse hiç değişmiyor; 10 günde bir tazelemek yeterli.
export const KAZANIMLAR_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000; // 10 gün

export function kazanimlarCacheKey(gradeId: string, lessonId: string) {
  return `ders-kazanimlar-all:${gradeId}:${lessonId}`;
}

export const SPECIAL_WEEK_META: Record<SpecialWeekEvent['eventType'], { icon: string; card: string }> = {
  break: { icon: '🏖️', card: 'bg-amber-50 border-amber-200 text-amber-800' },
  special_content: { icon: '✨', card: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  social_activity: { icon: '🎉', card: 'bg-violet-50 border-violet-200 text-violet-800' },
};

export const STUDY_TIPS = [
  'Bir konuyu okuduktan sonra kendi cümlelerinle özetlemek, kalıcılığı artırır.',
  'Kısa aralıklarla tekrar etmek, tek seferde uzun çalışmaktan daha etkilidir.',
  'Öğrendiğin bir konuyu birine anlatmayı dene, eksiklerin hemen ortaya çıkar.',
  'Not alarak okumak, sadece okumaktan daha kalıcı öğrenme sağlar.',
  'Zor gelen kısımları atlamak yerine üzerinde durup anlamaya çalış.',
  'Öğrendiklerini küçük şemalar veya kutucuklarla görselleştirmek, hatırlamayı kolaylaştırır.',
  'Bir konuyu bitirince kendine sorular sorup cevaplamaya çalış, bu en iyi tekrar yöntemidir.',
  'Yeni öğrendiğin bir bilgiyi daha önce bildiğin bir şeyle ilişkilendirmek, akılda kalıcılığı artırır.',
  'Uykudan hemen önce kısa bir tekrar yapmak, bilgilerin kalıcı hafızaya geçmesine yardımcı olur.',
  'Çalışırken telefonunu uzak tutmak, dikkatini konuya vermeni kolaylaştırır.',
  'Bir konuyu anlamadan ezberlemeye çalışmak yerine, önce mantığını kavramaya odaklan.',
  'Düzenli kısa molalar vermek, uzun süre aralıksız çalışmaktan daha verimlidir.',
  'Bir günde çok fazla konuya yüzeysel değil, az konuya derinlemesine çalışmak daha kalıcıdır.',
  'Örnek sorular çözmek, konuyu gerçekten anlayıp anlamadığını en iyi gösteren yöntemdir.',
  'Kendi kelimelerinle bir özet çıkarmak, konuyu pasif okumaktan çok daha etkilidir.',
];
