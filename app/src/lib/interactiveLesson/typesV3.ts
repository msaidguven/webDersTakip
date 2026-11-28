// Etkileşimli Ders v3 Şeması: Tek-Bilgi Anlatım + Bölüm İçi Modüler Oyun Platformu.
// Mevcut v1 (types.ts) ve v2 (typesV2.ts) şemalarını bozmadan yeni nesil iki sütunlu oynatıcıyı besler.
import type { BlankQuestion, MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import type { LessonTerm } from './types';

export type V3SceneId = 'digestive-system' | 'generic';

export type V3FilterSandboxFilter = {
  id: string;
  /** Çip üzerinde yazan kısa etiket (örn. 'site:meb.gov.tr', '"kara delik"', '3 ile bölünür') */
  label: string;
  /** Çip açıldığında temel ifadenin nasıl görüneceği (opsiyonel önizleme parçası) */
  queryToken?: string;
  /** Bu çip aktifken hangi sonuç özelliği vurgulanır */
  hint: string;
};

export type V3FilterSandboxItem = {
  id: string;
  /** Kart başlığı (örn. sayfa başlığı, sayı, madde adı) */
  title: string;
  /** İkincil satır (örn. URL: "meb.gov.tr/fen/gunes.pdf" veya kısa açıklama) */
  meta?: string;
  /** Köşe rozeti (örn. "PDF", "DOC", "WEB", "Çift") */
  badge?: string;
  /** Kartın kısa gövde özeti (1 satır) */
  snippet?: string;
  /** Bu kartın HANGİ filtre ID'lerine uyduğu */
  matches: string[];
};

export type V3FilterSandboxVisual = {
  kind: 'filter_sandbox';
  /** Tek satırlık görev (örn. "Sadece MEB sitesindeki Güneş Sistemi PDF dosyasını bul.") */
  task: string;
  /** Arama çubuğu veya kural başlığında sabit görünen temel ifade (örn. "güneş sistemi") */
  baseQuery?: string;
  /** Dokunmatik aç/kapa çipleri (1–3 adet) */
  filters: V3FilterSandboxFilter[];
  /** Canlı filtrelenecek 3–4 adet mini örnek kart */
  items: V3FilterSandboxItem[];
  /** Görevin tamamlanması için açık olması gereken filtre ID'leri */
  goalFilterIds: string[];
  /** Hedef kombinasyon açılınca çıkacak 1 cümlelik öğretici dönüt */
  successNote: string;
};

export type V3TokenBuilderVisual = {
  kind: 'token_builder';
  /** Tek satırlık görev (örn. "Başlığında robot geçen PDF dosyalarını arayacak komutu kur.") */
  task: string;
  /** Seçilebilecek çipler (doğrular + 1–2 çeldirici, toplam 3–6 çip) */
  tokens: string[];
  /** Doğru sıralı çip listesi (hepsi tokens içinde olmalı) */
  solution: string[];
  /** Sıra önemsizse true (ör. arama operatörleri veya toplama) */
  anyOrder?: boolean;
  /** Doğru kurulunca gösterilecek canlı sonuç özeti */
  resultPreview: string;
  /** Yanlış denemede 1 cümlelik yol gösterici ipucu */
  hint: string;
};

export type V3ClassifyTapCard = {
  text: string;
  bucketIndex: number;
  note: string;
};

export type V3ClassifyTapVisual = {
  kind: 'classify_tap';
  /** Tek satırlık görev (örn. "Her iletişim aracını doğru gruba ayır.") */
  task: string;
  /** 2–3 kategori etiketi */
  buckets: string[];
  /** 3–4 örnek kart */
  cards: V3ClassifyTapCard[];
};

export type V3SpotHighlightSegment = {
  text: string;
  isTarget?: boolean;
  /** Dokunulduğunda çıkan 1 cümlelik açıklama */
  feedback: string;
};

export type V3SpotHighlightVisual = {
  kind: 'spot_highlight';
  /** Tek satırlık görev (örn. "Bu olayda gürültü olan parçaya dokun.") */
  task: string;
  /** Yan yana dizilen tıklanabilir cümle parçaları (3–7 parça) */
  segments: V3SpotHighlightSegment[];
};

export type V3CauseEffectDialState = {
  /** Kademe etiketi (örn. "Düşük", "Orta", "Yüksek" veya "Katı", "Sıvı", "Gaz") */
  label: string;
  /** Öne çıkan değer/durum (örn. "Katı Hal", "1000+ Yıl") */
  headline: string;
  /** 1–2 kısa gözlem maddesi */
  effects: string[];
  /** Opsiyonel gösterge doluluk oranı (0–100) */
  meter?: number;
};

export type V3CauseEffectDialVisual = {
  kind: 'cause_effect_dial';
  /** Kontrol edilen değişken adı (örn. "Sıcaklık", "Şifre Karmaşıklığı") */
  controlLabel: string;
  /** 2–3 kademeli durum listesi */
  states: V3CauseEffectDialState[];
  /** Tüm kademeler gezilince çıkacak özet çıkarım */
  takeaway: string;
};

export type V3StepRevealNext = {
  /** Sıradaki adımı tahmin ettiren kısa soru */
  prompt: string;
  /** 2 seçenekli tahmin düğmeleri */
  options: [string, string];
  /** Doğru seçeneğin indeksi (0 veya 1) */
  answer: 0 | 1;
  /** Doğru bilinince çıkacak 1 cümlelik öğretici not */
  okNote: string;
};

export type V3StepRevealVisual = {
  kind: 'step_reveal';
  /** Tek satırlık görev (örn. "Deneyin sonraki aşamalarını tahmin ederek zinciri kur.") */
  task: string;
  /** Başlangıç adımı (açık görünür) */
  startStep: string;
  /** Öğrencinin sırayla tahmin edeceği 2–3 adım */
  nextSteps: V3StepRevealNext[];
};

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
    }
  | V3FilterSandboxVisual
  | V3TokenBuilderVisual
  | V3ClassifyTapVisual
  | V3SpotHighlightVisual
  | V3CauseEffectDialVisual
  | V3StepRevealVisual;

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
  /** Tek net bilgi: 1-2 kısa cümle (ekranda Atom balonunda görünür). */
  fact: string;
  /** Azure TTS için ekrandan ayrı, doğal öğretmen anlatımı (sembolsüz). */
  narration?: string;
  /**
   * Öğretim görselinin her parçasına (kart/madde/adım) birebir karşılık gelen sıralı öğretmen anlatımı.
   * Varsa oynatıcı parçaları sesle senkron olarak sırayla açar ve vurgular; yoksa `narration` tek parça çalar.
   */
  narrationSteps?: string[];
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
  /** v3.1: mikro-laboratuvarlı; v3.2: ses-senkronlu parçalı öğretmen anlatımı + 2 aşamalı laboratuvar. */
  schemaVersion?: '3.1' | '3.2';
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

export function isInteractiveBeatVisual(visual?: V3BeatVisual): boolean {
  return (
    visual?.kind === 'filter_sandbox' ||
    visual?.kind === 'token_builder' ||
    visual?.kind === 'classify_tap' ||
    visual?.kind === 'spot_highlight' ||
    visual?.kind === 'cause_effect_dial' ||
    visual?.kind === 'step_reveal'
  );
}

/** Öğretim görselinin ses-senkronlu kademeli açılım için beklediği parça sayısı (etkileşimli laboratuvarlarda 0). */
export function expectedNarrationStepCount(visual?: V3BeatVisual): number {
  if (!visual || isInteractiveBeatVisual(visual)) return 0;
  switch (visual.kind) {
    case 'compare':
    case 'equation':
      return 2;
    case 'steps':
    case 'cards':
      return visual.items.length;
    case 'highlight':
      return visual.bullets.length;
    default:
      return 0;
  }
}

export function isLessonV3(lesson: unknown): lesson is LessonDefinitionV3 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 3;
}

export function isHydratedV3(lesson: unknown): lesson is HydratedLessonV3 {
  return typeof lesson === 'object' && lesson !== null && 'version' in lesson && (lesson as { version?: number }).version === 3;
}
