// "Video / Sesli Anlatım" veri sözleşmesi. Üretici (scripts/generate-narration.ts) bu manifesti
// Storage'a yazar, NarrationPlayer okur. Alan eklemek serbest; mevcut alanların anlamını
// değiştirmek gerekirse NARRATION_MANIFEST_VERSION artırılmalı (oynatıcı eski sürümü reddeder).
export const NARRATION_MANIFEST_VERSION = 1;

// Ekranda tek seferde beliren 2-4 kelimelik grup. `start`, ekranın ses dosyasındaki saniye;
// şu an karakter-oranından tahmin ediliyor (bkz. timing.ts). Kelime zaman damgası veren bir TTS'e
// geçilirse yalnızca üretici değişir, oynatıcı aynı kalır.
export type NarrationChunk = {
  parts: { t: string; em?: true }[];
  start: number;
};

export type NarrationScreen = {
  id: string;
  // title: bölüm başlığı · heading: bölüm içindeki ara başlık (### …, 2026-10-02'den beri
  // seslendiriliyor) · sentence: cümle. Eski oynatıcı bilinmeyen türü cümle gibi çizer.
  kind: 'title' | 'heading' | 'sentence';
  // Ara başlık (### ...) — cümle ekranlarının üstünde küçük etiket olarak da gösterilir.
  eyebrow: string | null;
  chunks: NarrationChunk[];
  audio: { path: string; duration: number };
};

export type NarrationSection = {
  sectionId: number;
  title: string;
  screens: NarrationScreen[];
};

export type NarrationManifest = {
  version: typeof NARRATION_MANIFEST_VERSION;
  topicId: number;
  topicTitle: string;
  // Kaynak alt başlık metinlerinin özeti — içerik değişince manifest bayatlamış demektir.
  sourceHash: string;
  voice: { provider: 'gemini' | 'azure'; model: string; voice: string };
  generatedAt: string;
  sections: NarrationSection[];
};
