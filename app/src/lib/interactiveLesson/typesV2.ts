// Etkileşimli ders v2 şeması (oyunlaştırılmış öğrenme mimarisi).
// AI ileride çizim yapmaz; hazır tema kimliklerini (V2ThemeId) ve mikro-oyun tiplerini veriyle doldurur.
// Mevcut v1 şemasına (types.ts) dokunulmaz; hydrate.ts ve InteractiveLessonPlayer.tsx version alanına göre yönlendirir.
import type { BlankQuestion, MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import type { LessonTerm } from './types';

export type V2ThemeId = 'lab-capsule' | 'time-machine' | 'explorer-compass' | 'detective-lens';

export type V2StoryStep = {
  kind: 'story';
  emoji: string;
  say: string;
  /** Tek odaklı kısa vurgu etiketi (isteğe bağlı). */
  badge?: string;
};

export type V2KavramAviStep = {
  kind: 'kavram_avi';
  say: string;
  /** Aranan kavram (tek veya çok kelimeli, ör. "VİLLUS" veya "SAFRA SIVISI"). */
  word: string;
  /** Boş bırakılırsa hydrate.ts konunun topic_content_highlights kaydından otomatik doldurur. */
  definition?: string;
  /** topic_content_highlights eşleştirme anahtarı (termSlug); verilmezse word üzerinden türetilir. */
  highlightSlug?: string;
  feedback: string;
};

export type V2SliderStep = {
  kind: 'slider';
  say: string;
  left: { label: string; emoji: string; text: string };
  right: { label: string; emoji: string; text: string };
  leftTag?: string;
  rightTag?: string;
  feedback?: string;
};

export type V2HatRound = {
  scene: string;
  place: string;
  options: { emoji: string; label: string }[];
  answer: number;
  feedback: string;
};

export type V2HatStep = {
  kind: 'hat';
  say: string;
  slotPrompt?: string;
  rounds: V2HatRound[];
};

export type V2MatchStep = {
  kind: 'match';
  say: string;
  pairs: [string, string][];
  feedback?: string;
};

export type V2OrderStep = {
  kind: 'order';
  say: string;
  slotPlaceholder?: string;
  /** Doğru sırada verilir; istemcide karıştırılır. */
  items: string[];
  feedback?: string;
};

export type V2SwipeSortStep = {
  kind: 'swipe_sort';
  say: string;
  leftLabel: string;
  rightLabel: string;
  hint: string;
  items: { text: string; side: 'L' | 'R' }[];
  feedback?: string;
};

/** Yeni mikro-oyun 1: Hata Avcısı — cümledeki bilimsel olarak yanlış tek ifadeye dokun. */
export type V2SpotErrorStep = {
  kind: 'spot_error';
  say: string;
  /** Cümleyi oluşturan kısa parça/kelime blokları. */
  tokens: string[];
  /** Yanlış ifadenin tokens içindeki indeksi. */
  errorIndex: number;
  /** Doğru ifade (dokunulunca bu kelimeye dönüşür). */
  correction: string;
  hint: string;
  feedback: string;
};

/** Yeni mikro-oyun 2: Senaryo Kararı — günlük yaşam / laboratuvar durumuna en doğru tepkiyi seç. */
export type V2ScenarioRound = {
  emoji: string;
  situation: string;
  options: { label: string; feedback: string }[];
  answer: number;
};

export type V2ScenarioStep = {
  kind: 'scenario';
  say: string;
  rounds: V2ScenarioRound[];
};

/** Veritabanı soru havuzundan gerçek soru (hydrate.ts tarafından doldurulur). */
export type V2PoolQuestionStep = {
  kind: 'pool_question';
  say?: string;
  questionId: number;
};

export type HydratedV2PoolQuestionStep = {
  kind: 'pool_question';
  say?: string;
  question: MultipleChoiceQuestion | BlankQuestion;
};

export type V2Step =
  | V2StoryStep
  | V2KavramAviStep
  | V2SliderStep
  | V2HatStep
  | V2MatchStep
  | V2OrderStep
  | V2SwipeSortStep
  | V2SpotErrorStep
  | V2ScenarioStep
  | V2PoolQuestionStep;

export type HydratedV2Step =
  | Exclude<V2Step, V2PoolQuestionStep>
  | HydratedV2PoolQuestionStep;

export type V2Stop = {
  sectionId: number;
  title: string;
  subtitle: string;
  /** Durak düğmesi rengi (hex). */
  color: string;
  /** Sahne içi vurgu tonu (açık pastel hex). */
  tint: string;
  /** Bu durak tamamlanınca toplanan parça. */
  part: { emoji: string; name: string };
  steps: V2Step[];
};

export type HydratedV2Stop = Omit<V2Stop, 'steps'> & {
  steps: HydratedV2Step[];
};

export type LessonDefinitionV2 = {
  version: 2;
  topicId: number;
  themeId: V2ThemeId;
  adventureTitle: string;
  subtitle: string;
  badgeTitle: string;
  courseLabel: string;
  stops: V2Stop[];
  guide?: { intro: string; finish: string };
};

export type HydratedLessonV2 = Omit<LessonDefinitionV2, 'stops'> & {
  topicTitle: string;
  stops: HydratedV2Stop[];
  terms: Record<string, LessonTerm>;
};

export function isLessonV2(lesson: unknown): lesson is LessonDefinitionV2 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 2;
}

export function isHydratedV2(lesson: unknown): lesson is HydratedLessonV2 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 2;
}
