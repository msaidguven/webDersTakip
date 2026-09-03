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

async function callGemini(prompt: string, temperature: number): Promise<string> {
  const res = await fetch(
    `${API_BASE}/models/${CHAT_MODEL}:generateContent?key=${getApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature },
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
  return answer;
}

// Soruyu SADECE verilen ders notu parçalarına dayanarak cevaplar. Parçalarda
// yeterli bilgi yoksa modelin "bu bilgi ders notlarında yok" demesi isteniyor.
// questionContext: test sayfasından soruluyorsa aktif sorunun (kökü+şıklar+doğru
// cevap) özeti — "neden A" gibi bağlamsız kısa sorularda hangi sorudan
// bahsedildiğini modele bildirmek için.
export async function generateGroundedAnswer(
  question: string,
  contextChunks: string[],
  questionContext?: string | null,
  replyContext?: string | null
): Promise<AnswerResult> {
  const context = contextChunks
    .map((chunk, i) => `[Parça ${i + 1}]\n${chunk}`)
    .join('\n\n');

  // Test sorusu bağlamında öğrenci hızlı bir açıklama istiyor, uzun bir ders notu
  // değil — bu yüzden bu modda kesin bir karakter sınırı da ekleniyor.
  const questionContextBlock = questionContext
    ? `\n\nÖğrenci şu anda bir test sorusuna bakıyor:\n${questionContext}\n\nÖğrencinin sorusu bu test sorusuyla ilgili olabilir (ör. "neden A" demek "bu test sorusunun cevabı neden A" demektir) — bu bağlamı kullanarak yorumla.\n\nBu bir test sorusu açıklaması olduğu için cevabın KISA olsun: 300-400 karakter civarı, kesinlikle 500 karakteri geçme. Uzun madde listeleri veya birden fazla paragraf yazma — sadece doğru cevabın neden doğru olduğunu 2-3 cümleyle açıkla.\n`
    : '';

  // Öğrenci bir yoruma/önceki cevaba "yanıt" olarak soru soruyorsa (ör. "neden
  // olmaz"), o mesajı görmeden soru anlamsız kalır — burada iletiyoruz.
  const replyContextBlock = replyContext
    ? `\n\nÖğrenci şu mesaja yanıt veriyor:\n"${replyContext}"\n\nÖğrencinin sorusu ("${question}") bu mesajla ilgili olabilir — bağlamı kullanarak yorumla, mesajda neden bahsedildiğini bilmiyormuş gibi davranma.\n`
    : '';

  const prompt = `Aşağıda bir ders notundan alınmış metin parçaları var. Öğrencinin sorusunu SADECE bu parçalarda yer alan bilgiye dayanarak cevapla.

Kurallar:
- Parçalarda cevap için yeterli bilgi yoksa, başka hiçbir şey söylemeden tam olarak şunu yaz: "Bu bilgi ders notlarında yok."
- Parçaların dışında hiçbir genel bilgini veya varsayımını kullanma.
- Metin "biz/bizim" gibi genel bir dille yazılmış olabilir (ör. "ailede çocuk, okulda öğrenci rolüne sahip oluruz"). Öğrenci bunu "benim/kendim" diye kişiselleştirerek sorsa bile (ör. "rollerim nelerdir"), metindeki bu genel bilgiyi doğrudan cevap olarak kullan — bunu reddetme veya "bu senin kişisel bilgin değil" deme.
- Sıcak ve samimi bir öğretmen gibi yaz; soğuk, sadece madde sıralayan bir liste bırakma. Cevaba kısa bir giriş cümlesiyle başla, madde listesi kullanacaksan her maddeyi tek kelimeyle bırakmak yerine mümkün olduğunca 2-3 kelimelik kısa bir açıklama/örnek ekle (metinde varsa), ve cevabın sonuna kısa, samimi bir kapanış cümlesi ekle (ör. "Umarım yardımcı olmuştur!" gibi, her seferinde birebir aynı olmasın).
- Cevabın toplam uzunluğu KESİNLİKLE 800 karakteri geçmesin — hedefin 500-600 karakter civarı olsun ki payın olsun (bu zorunlu bir sınır, tahmini değil). Parçalarda çok sayıda örnek/madde olsa bile HEPSİNİ sıralama — en önemli 2-3 taneyi seç, "başka örnekler de var" gibi bir not ekleyebilirsin ama liste kısa kalsın. Öğrenciler uzun cevapları zaten okumuyor.
${questionContextBlock}${replyContextBlock}
Ders notu parçaları:
${context}

Öğrenci sorusu: ${question}`;

  // 0.2 bile bazı sınırda sorularda (ör. metnin "biz" diliyle anlattığı bir bilgiyi
  // "benim" diye kişiselleştiren sorularda) aynı bağlamla farklı seferlerde tutarsız
  // cevaplara (bazen doğru cevap, bazen "yok" reddi) yol açtı. 0'a çekmek bu tür
  // sınır durumlarda tutarlılığı artırıyor.
  const answer = await callGemini(prompt, 0);
  return { answer, model: CHAT_MODEL };
}

// "@kanka" modu: @hocam'ın "sadece verilen metne dayan" kısıtı yok, ama sınırsız
// da değil — ünitenin KONUSUYLA ilgili olduğu sürece (kitapta yazmasa bile) genel
// bilgi kullanabilir, dersle hiç alakası olmayan kişisel/sosyal sorulara girmez.
// Site bir ders çalışma aracı olduğu için @kanka'nın "sohbet arkadaşına" dönüşüp
// öğrenciyi asıl çalışmadan (@hocam, ders notu) uzaklaştırmaması bilinçli bir tercih.
export async function generateBuddyAnswer(
  question: string,
  gradeName: string | null,
  lessonName: string | null,
  unitName: string | null,
  contextChunks: string[],
  questionContext?: string | null,
  replyContext?: string | null
): Promise<AnswerResult> {
  const contextLine = [gradeName, lessonName].filter(Boolean).join(' ');
  const context = contextChunks.length
    ? `\n\nBu ünitenin ders notlarından bulunan ilgili parçalar (varsa öncelikle bunlara dayan):\n${contextChunks
        .map((c, i) => `[Parça ${i + 1}]\n${c}`)
        .join('\n\n')}\n`
    : '';

  // @hocam'daki questionContextBlock ile aynı amaç: "neden A" gibi bağlamsız kısa
  // sorularda öğrencinin hangi test sorusundan bahsettiğini modele bildirmek —
  // önceden sadece @hocam'a gidiyordu, @kanka bu yüzden aynı soruyu "görmüyormuş"
  // gibi davranıyordu (2026-09-03'te bildirildi).
  const questionContextBlock = questionContext
    ? `\n\nÖğrenci şu anda bir test sorusuna bakıyor:\n${questionContext}\n\nSorusu bu test sorusuyla ilgili olabilir (ör. "neden A" demek "bu sorunun cevabı neden A" demektir) — bu bağlamı kullanarak yorumla.\n`
    : '';

  const replyContextBlock = replyContext
    ? `\n\nÖğrenci şu mesaja yanıt veriyor:\n"${replyContext}"\n\nSorusu ("${question}") bu mesajla ilgili olabilir — bağlamı kullanarak yorumla, neden bahsedildiğini bilmiyormuş gibi davranma.\n`
    : '';

  const prompt = `Sen bir öğrencinin ders çalışırken yanında olan, meraklı ve bilgili bir arkadaşısın — rahat ve sıcak konuşursun ama bir komedyen değilsin, gereksiz şaka/emoji yapmazsın.
${contextLine ? `Öğrenci ${contextLine} dersini alıyor.` : ''}${unitName ? ` Şu an "${unitName}" ünitesini çalışıyor.` : ''}

Kurallar:
- Önce ders notlarından bulunan parçalara bak (aşağıda varsa). Orada varsa ona dayan.
- Orada yoksa ama soru "${unitName || 'bu ünitenin konusu'}" ile aynı KONU alanındaysa (ör. ünite "Güneş" ise ve soru gezegenlerle ilgiliyse), kitapta yazmasa bile kendi genel bilgini kullanarak eğitici bir cevap ver.
- Ama soru bu dersin/ünitenin konusuyla HİÇ alakası olmayan kişisel/sosyal bir şeyse (favori hayvanın ne, dünkü maç kimin, bugün hava nasıl gibi), kısaca "bu konudan biraz uzak, ders/ünite ile ilgili bir şey sorsan yardımcı olurum" de ve cevaplama.
- Emin olmadığın bir şeyi kesin bilgiymiş gibi uydurma; şüpheliysen dürüstçe belirt.
- Okul çağındaki bir öğrenciyle konuştuğunu unutma: küfür, argo, uygunsuz hiçbir şey söyleme.
- Cevabı kısa tut: 300-500 karakter civarı.
- Cevap gerçekten bir bilgi içeriyorsa (reddetme durumu hariç), sonuna kısa bir cümleyle ders notlarına da bakmasını öner (ör. "Ders notlarında da bu konuyla ilgili bilgi olabilir, göz atmanı öneririm!") — her seferinde birebir aynı cümle olmasın.
${context}${questionContextBlock}${replyContextBlock}
Öğrencinin sorusu: ${question}`;

  const answer = await callGemini(prompt, 0.6);
  return { answer, model: `${CHAT_MODEL}-kanka` };
}
