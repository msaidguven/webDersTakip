import { extractJson } from '@/app/src/lib/extractJson';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-3.6-flash';

// Soru üretme worker'ıyla (geminiQuestionGen.ts) AYNI free-tier kotayı paylaşmasın diye
// kendi API key'i var (kullanıcının 2026-09-19 isteği). GEMINI_API_KEY (öğrenci sohbeti)
// sadece 429'da son çare olarak devreye giriyor, GEMINI_API_KEY_QUESTIONS'a hiç dokunulmuyor.
function getApiKeys(): string[] {
  const raw = [process.env.GEMINI_API_KEY_CONTENT, process.env.GEMINI_API_KEY].filter((k): k is string => !!k);
  const keys = [...new Set(raw)];
  if (!keys.length) throw new Error('GEMINI_API_KEY_CONTENT (veya GEMINI_API_KEY) tanımlı değil');
  return keys;
}

async function callGenerateContent(prompt: string, apiKey: string): Promise<Response> {
  return fetch(`${API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`, {
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

export async function generateTopicContentJson(prompt: string): Promise<unknown> {
  const keys = getApiKeys();
  let res: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    res = await callGenerateContent(prompt, keys[i]);
    if (res.status === 503) {
      await sleep(RETRY_ON_503_DELAY_MS);
      res = await callGenerateContent(prompt, keys[i]);
    }
    if (res.ok) break;
    const isLastKey = i === keys.length - 1;
    if (res.status !== 429 || isLastKey) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini generateContent hatası (${res.status}): ${errText}`);
    }
    // 429 ve elde başka key var — yedek key ile devam et.
  }

  const data = (await res!.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini boş cevap döndürdü');
  return extractJson(text);
}
