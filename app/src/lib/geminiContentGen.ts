import { extractJson } from '@/app/src/lib/extractJson';
import { CONTENT_WORKER_PROFILES, type ContentWorkerProfile } from '@/app/src/lib/contentWorkerProfiles';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKeys(profile: ContentWorkerProfile): string[] {
  const raw = profile.apiKeyEnvs.map((name) => process.env[name]).filter((k): k is string => !!k);
  const keys = [...new Set(raw)];
  if (!keys.length) throw new Error(`${profile.apiKeyEnvs.join(' / ')} tanımlı değil`);
  return keys;
}

async function callGenerateContent(prompt: string, model: string, apiKey: string): Promise<Response> {
  return fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Eskiden 503'te AYNI modeli 4 dk bekleyip tekrar deniyordu — gün boyu yoğun olan bir
// modelde bu hem neredeyse hiç işe yaramıyordu hem de bekleme + uzun üretim Vercel'in 300 sn
// sınırını aşıp çalışmayı log bile yazamadan öldürüyordu. Artık önce diğer modele geçiliyor;
// hepsi 503 ise kısa bir beklemeyle sadece 503 verenler bir kez daha deneniyor.
const RETRY_ALL_OVERLOADED_DELAY_MS = 30 * 1000;

type Attempt = { key: string; model: string };

export interface GeneratedContentJson {
  data: unknown;
  // Cevabı gerçekten veren model (fallback devreye girmiş olabilir).
  model: string;
}

export async function generateTopicContentJson(
  prompt: string,
  profile: ContentWorkerProfile = CONTENT_WORKER_PROFILES.primary
): Promise<GeneratedContentJson> {
  const models = [profile.model, ...profile.fallbackModels.filter((m) => m !== profile.model)];
  // Key önce: aynı key'in kotası tüm modellerde denenmeden yedek key'e (başka bir işin
  // kotası) geçilmez.
  let pending: Attempt[] = getApiKeys(profile).flatMap((key) => models.map((model) => ({ key, model })));
  const failures: string[] = [];

  for (let pass = 0; pass < 2 && pending.length; pass++) {
    if (pass > 0) await sleep(RETRY_ALL_OVERLOADED_DELAY_MS);
    const overloaded: Attempt[] = [];
    for (const attempt of pending) {
      const res = await callGenerateContent(prompt, attempt.model, attempt.key);
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
        if (!text) throw new Error(`Gemini boş cevap döndürdü (${attempt.model})`);
        return { data: extractJson(text), model: attempt.model };
      }
      // 503 = model yoğun, 429 = bu key'in bu modeldeki kotası dolu — ikisinde de sıradaki
      // kombinasyon denenir. Diğer hatalar (400, 403...) istek/key sorunudur, devam etmenin anlamı yok.
      if (res.status !== 503 && res.status !== 429) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini generateContent hatası (${attempt.model}, ${res.status}): ${errText}`);
      }
      failures.push(`${attempt.model}: ${res.status}`);
      if (res.status === 503) overloaded.push(attempt);
    }
    pending = overloaded;
  }

  throw new Error(`Gemini generateContent hatası, tüm modeller başarısız (${failures.join(', ')})`);
}
