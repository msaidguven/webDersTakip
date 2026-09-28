// Soru üretimi için Gemini JSON çağrısı — rag/gemini.ts'teki callGemini'den farklı: o düz
// metin cevap (öğrenciye @hocam/@kanka) için, bu ise yapılandırılmış soru JSON'u için.
//
// Her soru worker'ı kendi key'i ve modeliyle çalışır (bkz. questionWorkerProfiles.ts);
// admin panelindeki manuel üretim (classical-questions/generate) primary profili kullanır.
// Free-tier kotası proje+model başına 20/gün — key paylaşan işler birbirinin kotasını
// tüketiyordu (2026-09-10), o yüzden her worker'ın ayrı key'i var.
//
// 503'te artık 4 dk bekleyip aynı modeli tekrar denemek yerine diğer modele geçiliyor
// (içerik worker'larındaki 2026-09-25 desen, bkz. geminiJsonGen.ts) — son 3 günde soru
// çalışmalarının ~%40'ı 503 ile boşa gidiyordu (2026-09-28 ölçüm).
import { generateGeminiJson, type GeneratedJson } from '@/app/src/lib/geminiJsonGen';
import { QUESTION_WORKER_PROFILES, type QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';

export async function generateQuestionsJson(
  prompt: string,
  profile: QuestionWorkerProfile = QUESTION_WORKER_PROFILES.primary
): Promise<GeneratedJson> {
  return generateGeminiJson(prompt, profile);
}
