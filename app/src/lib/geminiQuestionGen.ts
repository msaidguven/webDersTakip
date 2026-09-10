// Klasik soru otomatik üretimi için Gemini'ye JSON modunda (responseMimeType:
// application/json) çağrı — rag/gemini.ts'teki callGemini'den farklı: o düz metin cevap
// (öğrenciye @hocam/@kanka) için, bu ise yapılandırılmış soru JSON'u için.
//
// KENDİ API KEY'İNİ kullanır (rag/gemini.ts'teki GEMINI_API_KEY'den AYRI) — ikisi aynı
// key'i paylaştığında Google'ın free-tier günlük kotası (generativelanguage.googleapis.com/
// generate_content_free_tier_requests, proje+model başına 20/gün) ortak havuzdan tükeniyordu;
// rag-queue-worker 5 dakikada bir çalıştığı için soru taslağı worker'ı gün boyu hep 429
// (RESOURCE_EXHAUSTED) alıyordu (2026-09-10 kullanıcı bildirimi, "son 20 çalıştırmadan 0'ı
// taslak üretti").
//
// Normal koşulda SADECE GEMINI_API_KEY_QUESTIONS kullanılır (rag/gemini.ts'in GEMINI_API_KEY'i
// ile paylaşılan bir kotayı boşuna tüketmesin diye). Ama bu key kendi 20/gün kotasını
// tüketirse (429/RESOURCE_EXHAUSTED) — ki saatlik cron 24/gün çalıştığı için günün son
// saatlerinde beklenen bir durum — aynı istek YEDEK olarak GEMINI_API_KEY ile bir kez daha
// denenir; boş kalmaktansa öğrenci sohbetinin kotasından ödünç alır. Kota DIŞI bir hatada
// (400/500/503 vb.) ikinci key'de de aynı şekilde başarısız olacağından, o key'in kotasını
// boşuna harcamamak için hemen fırlatılır, denenmez.
// gemini-2.5-flash "yeni kullanıcılar" (yeni proje/key) için Google tarafından
// kaldırıldı — GEMINI_API_KEY_QUESTIONS bugün oluşturulmuş yeni bir projede olduğundan
// 404 "no longer available to new users" alıyordu (2026-09-10, saatlik cron loglarında
// 09:00-17:00 arası her çalıştırmada). Google'ın önerdiği gemini-3.6-flash hem eski hem
// yeni key ile test edildi, ikisinde de çalışıyor — ayrıca kota da model başına ayrı
// sayıldığından (bkz. yukarıdaki not) bu değişiklik quotaDimensions'ı da resetliyor.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'gemini-3.6-flash';

function getApiKeys(): string[] {
  const raw = [process.env.GEMINI_API_KEY_QUESTIONS, process.env.GEMINI_API_KEY].filter((k): k is string => !!k);
  const keys = [...new Set(raw)];
  if (!keys.length) throw new Error('GEMINI_API_KEY_QUESTIONS (veya GEMINI_API_KEY) tanımlı değil');
  return keys;
}

// Admin panelindeki manuel akışla aynı prompt kullanıldığı için AI çıktısı yine
// ```json bloğu veya fazladan metinle gelebilir — extractJson ile aynı toleranslı
// ayrıştırmayı burada da uyguluyoruz (JSON modu bunu genelde önler ama garanti değil).
import { extractJson } from '@/app/src/lib/extractJson';

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

export async function generateQuestionsJson(prompt: string): Promise<unknown> {
  const keys = getApiKeys();
  let res: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    res = await callGenerateContent(prompt, keys[i]);
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
