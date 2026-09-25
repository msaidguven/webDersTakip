// Saf veri — hem sunucu (geminiContentGen.ts) hem admin paneli (client) import eder; key'lerin
// kendisi değil sadece env değişkeni ADLARI burada.

// İçerik üretimi iki bağımsız worker'dan yapılıyor (kullanıcının 2026-09-25 isteği): her biri
// kendi API key'i ve modeliyle, aynı prompt/şema ile. Ayrı key = ayrı free-tier kotası, ayrı
// model = ayrı model başına kota ve biri 503 verirken diğerinin çalışma şansı.
export type ContentWorkerId = 'primary' | 'secondary';

export interface ContentWorkerProfile {
  id: ContentWorkerId;
  model: string;
  // Ana model 503 (yoğunluk) verirse AYNI key ile sırayla denenen modeller. 503 model
  // başına, kota key başına — o yüzden model değiştirmek kotayı paylaştırmadan kurtarıyor.
  fallbackModels: string[];
  // pg_cron'daki çalışma dakikası (bilgi amaçlı, admin panelinde gösteriliyor).
  cronMinute: number;
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
    fallbackModels: ['gemini-3.8-flash'],
    cronMinute: 23,
    apiKeyEnvs: ['GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY'],
  },
  // Yalnızca kendi key'i — başka worker'ların kotasını yemesin.
  secondary: {
    id: 'secondary',
    model: 'gemini-3.8-flash',
    fallbackModels: ['gemini-3.6-flash'],
    cronMinute: 13,
    apiKeyEnvs: ['NEW_GEMINI_API_KEY_CONTENT'],
  },
};

// topic_section_content_drafts.ai_model / topic_contents'e yazılan okunur etiket — fallback
// devreye girdiyse profilin değil GERÇEKTEN cevap veren modelin adı yazılır.
// 'gemini-3.8-flash' → 'Gemini 3.8 Flash (otomatik taslak)'
export function contentModelLabel(model: string): string {
  const pretty = model
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${pretty} (otomatik taslak)`;
}
