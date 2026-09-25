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

const RETRY_ON_503_DELAY_MS = 4 * 60 * 1000;

export async function generateTopicContentJson(
  prompt: string,
  profile: ContentWorkerProfile = CONTENT_WORKER_PROFILES.primary
): Promise<unknown> {
  const keys = getApiKeys(profile);
  let res: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    res = await callGenerateContent(prompt, profile.model, keys[i]);
    if (res.status === 503) {
      await sleep(RETRY_ON_503_DELAY_MS);
      res = await callGenerateContent(prompt, profile.model, keys[i]);
    }
    if (res.ok) break;
    const isLastKey = i === keys.length - 1;
    if (res.status !== 429 || isLastKey) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini generateContent hatası (${profile.model}, ${res.status}): ${errText}`);
    }
    // 429 ve elde başka key var — yedek key ile devam et.
  }

  const data = (await res!.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini boş cevap döndürdü');
  return extractJson(text);
}
