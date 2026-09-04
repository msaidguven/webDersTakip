// Klasik soru otomatik üretimi için Gemini'ye JSON modunda (responseMimeType:
// application/json) çağrı — rag/gemini.ts'teki callGemini'den farklı: o düz metin cevap
// (öğrenciye @hocam/@kanka) için, bu ise yapılandırılmış soru JSON'u için. Aynı
// GEMINI_API_KEY'i kullanır, ayrı bir kurulum gerekmez.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-2.5-flash';

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY tanımlı değil');
  return key;
}

// Admin panelindeki manuel akışla aynı prompt kullanıldığı için AI çıktısı yine
// ```json bloğu veya fazladan metinle gelebilir — extractJson ile aynı toleranslı
// ayrıştırmayı burada da uyguluyoruz (JSON modu bunu genelde önler ama garanti değil).
import { extractJson } from '@/app/src/lib/extractJson';

export async function generateQuestionsJson(prompt: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/models/${MODEL}:generateContent?key=${getApiKey()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini generateContent hatası (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini boş cevap döndürdü');
  return extractJson(text);
}
