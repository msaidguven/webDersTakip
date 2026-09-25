// Saf veri — hem sunucu (geminiContentGen.ts) hem admin paneli (client) import eder; key'lerin
// kendisi değil sadece env değişkeni ADLARI burada.

// İçerik üretimi iki bağımsız worker'dan yapılıyor (kullanıcının 2026-09-25 isteği): her biri
// kendi API key'i ve modeliyle, aynı prompt/şema ile. Ayrı key = ayrı free-tier kotası, ayrı
// model = ayrı model başına kota ve biri 503 verirken diğerinin çalışma şansı.
export type ContentWorkerId = 'primary' | 'secondary';

export interface ContentWorkerProfile {
  id: ContentWorkerId;
  model: string;
  // topic_section_content_drafts.ai_model / topic_contents'e yazılan okunur etiket.
  label: string;
  // Sırayla denenen key'ler — sadece 429'da bir sonrakine geçilir.
  apiKeyEnvs: string[];
}

export const CONTENT_WORKER_PROFILES: Record<ContentWorkerId, ContentWorkerProfile> = {
  // Soru üretme worker'ıyla (geminiQuestionGen.ts) AYNI free-tier kotayı paylaşmasın diye
  // kendi API key'i var (kullanıcının 2026-09-19 isteği). GEMINI_API_KEY (öğrenci sohbeti)
  // sadece 429'da son çare olarak devreye giriyor, GEMINI_API_KEY_QUESTIONS'a hiç dokunulmuyor.
  primary: {
    id: 'primary',
    model: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash (otomatik taslak)',
    apiKeyEnvs: ['GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY'],
  },
  // Yalnızca kendi key'i — başka worker'ların kotasını yemesin.
  secondary: {
    id: 'secondary',
    model: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (otomatik taslak)',
    apiKeyEnvs: ['NEW_GEMINI_API_KEY_CONTENT'],
  },
};
