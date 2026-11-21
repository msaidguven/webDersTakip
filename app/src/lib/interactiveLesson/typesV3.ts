// Etkileşimli Ders v3 Şeması: Tek-Bilgi Anlatım + Bölüm İçi Modüler Oyun Platformu.
// Mevcut v1 (types.ts) ve v2 (typesV2.ts) şemalarını bozmadan yeni nesil iki sütunlu oynatıcıyı besler.
import type { BlankQuestion, MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import type { LessonTerm } from './types';

export type V3SceneId = 'digestive-system' | 'generic';

/** Yapay zekâ (Gemini worker) tarafından her konu için üretilebilen genel görsel şema türleri. */
export type V3BeatVisual =
  | {
      kind: 'highlight';
      badge: string;
      headline: string;
      bullets: string[];
    }
  | {
      kind: 'compare';
      left: { title: string; points: string[] };
      right: { title: string; points: string[] };
    }
  | {
      kind: 'steps';
      items: string[];
    }
  | {
      kind: 'cards';
      items: { title: string; detail: string }[];
    }
  | {
      kind: 'equation';
      inputs: string[];
      result: string;
    };

/** Sindirim Sistemi canlı SVG sahnesinin odak durumları. */
export type DigestiveFocusId =
  | 'overview-digestion'
  | 'physical-chewing'
  | 'surface-area'
  | 'chemical-breakdown'
  | 'enzyme-speed'
  | 'mouth'
  | 'pharynx'
  | 'esophagus'
  | 'stomach'
  | 'small-intestine'
  | 'villus-zoom'
  | 'large-intestine'
  | 'anus'
  | 'accessory-overview'
  | 'liver-gallbladder'
  | 'bile-physical'
  | 'pancreas-overview'
  | 'pancreas-chemical'
  | 'health-balanced'
  | 'health-chewing'
  | 'health-risks'
  | 'health-exercise'
  | 'health-screen';

/** Tek ekranda YALNIZCA 1 bilgi veren anlatım adımı. */
export type V3TeachBeat = {
  id: string;
  /** Kısa vurgu etiketi (örn. "1 / 5 • Fiziksel Sindirim"). */
  kicker: string;
  /** Kısa başlık (en fazla 4-5 kelime). */
  title: string;
  /** Tek net bilgi: 1-2 kısa cümle. */
  fact: string;
  /** Özel SVG sahneli konularda (örn. Sindirim Sistemi) canlı odak kimliği. */
  focus?: DigestiveFocusId;
  /** Genel konularda (AI üretimi dahil) bilgiyi görselleştiren yapısal kart/şema. */
  visual?: V3BeatVisual;
  /** İsteğe bağlı tek küçük etkileşim (tahmin / hızlı doğrulama). */
  quickCheck?: {
    prompt: string;
    options: string[];
    answer: number;
    okFeedback: string;
    retryFeedback: string;
  };
};

/** Modüler Oyun Kayıt Sistemi için ortak oyun konfigürasyonları (yeni oyunlar union'a eklenir). */
export type V3KavramAviRound = {
  word: string;
  /** Boş bırakılırsa hydrate.ts konunun topic_content_highlights verisinden doldurur. */
  definition?: string;
  highlightSlug?: string;
  praise: string;
};

export type V3KavramAviConfig = {
  kind: 'kavram_avi';
  title: string;
  intro: string;
  rounds: V3KavramAviRound[];
};

export type V3MiniGameConfig = V3KavramAviConfig;

export type V3Section = {
  sectionId: number;
  /** Üst HUD sekme adı (örn. "1. Sindirim Çeşitleri"). */
  tabLabel: string;
  /** Tam bölüm başlığı. */
  title: string;
  /** Bölüm vurgu rengi. */
  accent: 'sky' | 'amber' | 'emerald' | 'rose';
  /** Tek-bilgi anlatım ekranları. */
  beats: V3TeachBeat[];
  /** Anlatım bitince açılan bölüm içi pekiştirme oyunu. */
  game: V3MiniGameConfig;
  /** Oyun sonrası kısa bölüm kontrolü için gerçek havuz soru kimlikleri. */
  checkQuestionIds: number[];
};

export type LessonDefinitionV3 = {
  version: 3;
  topicId: number;
  courseLabel: string;
  sceneId: V3SceneId;
  sections: V3Section[];
  guide?: {
    intro: string;
    finish: string;
  };
};

export type HydratedV3Question = MultipleChoiceQuestion | BlankQuestion;

export type HydratedV3Section = Omit<V3Section, 'checkQuestionIds'> & {
  checkQuestions: HydratedV3Question[];
};

export type HydratedLessonV3 = Omit<LessonDefinitionV3, 'sections'> & {
  topicTitle: string;
  sections: HydratedV3Section[];
  terms: Record<string, LessonTerm>;
};

export function isLessonV3(lesson: unknown): lesson is LessonDefinitionV3 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 3;
}

export function isHydratedV3(lesson: unknown): lesson is HydratedLessonV3 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 3;
}
