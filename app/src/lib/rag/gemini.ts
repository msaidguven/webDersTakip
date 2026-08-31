// Gemini API'ye düz fetch ile erişim: embedding (belge parçaları + soru) ve
// "sadece verilen metne dayan" talimatlı cevap üretimi. Ek bir SDK'ya gerek
// yok, tek ihtiyacımız bu iki REST çağrısı.

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // supabase/migrations/add_rag_document_qa.sql içindeki vector(768) ile eşleşmeli
const CHAT_MODEL = 'gemini-2.5-flash';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY tanımlı değil');
  return key;
}

type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

async function embedBatch(texts: string[], taskType: EmbedTaskType): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(
    `${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${getApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini embedding hatası (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { embeddings?: { values: number[] }[] };
  const embeddings = data.embeddings || [];
  if (embeddings.length !== texts.length) {
    throw new Error('Gemini embedding yanıtı beklenen sayıda vektör içermiyor');
  }
  return embeddings.map((e) => e.values);
}

// PDF parçaları için: bir seferde en fazla 100 istek kabul ediyor (batchEmbedContents limiti),
// bu yüzden büyük belgelerde partiler halinde çağırıyoruz.
export async function embedDocumentChunks(chunks: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const result: number[][] = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch, 'RETRIEVAL_DOCUMENT');
    result.push(...embeddings);
  }
  return result;
}

export async function embedQuestion(question: string): Promise<number[]> {
  const [embedding] = await embedBatch([question], 'RETRIEVAL_QUERY');
  return embedding;
}

export type AnswerResult = { answer: string; model: string };

// Soruyu SADECE verilen ders notu parçalarına dayanarak cevaplar. Parçalarda
// yeterli bilgi yoksa modelin "bu bilgi ders notlarında yok" demesi isteniyor.
export async function generateGroundedAnswer(question: string, contextChunks: string[]): Promise<AnswerResult> {
  const context = contextChunks
    .map((chunk, i) => `[Parça ${i + 1}]\n${chunk}`)
    .join('\n\n');

  const prompt = `Aşağıda bir ders notundan alınmış metin parçaları var. Öğrencinin sorusunu SADECE bu parçalarda yer alan bilgiye dayanarak cevapla.

Kurallar:
- Parçalarda cevap için yeterli bilgi yoksa, başka hiçbir şey söylemeden tam olarak şunu yaz: "Bu bilgi ders notlarında yok."
- Parçaların dışında hiçbir genel bilgini veya varsayımını kullanma.
- Metin "biz/bizim" gibi genel bir dille yazılmış olabilir (ör. "ailede çocuk, okulda öğrenci rolüne sahip oluruz"). Öğrenci bunu "benim/kendim" diye kişiselleştirerek sorsa bile (ör. "rollerim nelerdir"), metindeki bu genel bilgiyi doğrudan cevap olarak kullan — bunu reddetme veya "bu senin kişisel bilgin değil" deme.
- Sıcak ve samimi bir öğretmen gibi yaz; soğuk, sadece madde sıralayan bir liste bırakma. Cevaba kısa bir giriş cümlesiyle başla, madde listesi kullanacaksan her maddeyi tek kelimeyle bırakmak yerine mümkün olduğunca 2-3 kelimelik kısa bir açıklama/örnek ekle (metinde varsa), ve cevabın sonuna kısa, samimi bir kapanış cümlesi ekle (ör. "Umarım yardımcı olmuştur!" gibi, her seferinde birebir aynı olmasın).
- Yine de gereksiz uzatma; sıcak ama kısa ve öz olsun.

Ders notu parçaları:
${context}

Öğrenci sorusu: ${question}`;

  const res = await fetch(
    `${API_BASE}/models/${CHAT_MODEL}:generateContent?key=${getApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // 0.2 bile bazı sınırda sorularda (ör. metnin "biz" diliyle anlattığı bir
        // bilgiyi "benim" diye kişiselleştiren sorularda) aynı bağlamla farklı
        // seferlerde tutarsız cevaplara (bazen doğru cevap, bazen "yok" reddi) yol
        // açtı. 0'a çekmek bu tür sınır durumlarda tutarlılığı artırıyor.
        generationConfig: { temperature: 0 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini generateContent hatası (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const answer = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!answer) throw new Error('Gemini boş cevap döndürdü');

  return { answer, model: CHAT_MODEL };
}
