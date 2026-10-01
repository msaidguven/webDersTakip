// Gemini TTS ile tek bir cümleyi seslendirir, 16-bit mono PCM döner.
// NOT: gemini-3.8-*-tts modelleri metne eklenen stil talimatını ("öğretmen gibi oku:") da sesli
// okuyor ve systemInstruction'ı reddediyor — bu yüzden istekte SADECE okunacak metin gönderiliyor.

export const GEMINI_TTS_SAMPLE_RATE = 24000;

export type GeminiTtsOptions = { apiKeys: string[]; model: string; voice: string };

class RetryableError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestOnce(text: string, key: string, model: string, voice: string): Promise<Int16Array> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (res.status === 429 || res.status >= 500) throw new RetryableError(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const inline = json?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData;
  if (!inline?.data) throw new RetryableError(`Gemini TTS ses dönmedi: ${JSON.stringify(json).slice(0, 200)}`);
  return decodeAudio(Buffer.from(inline.data, 'base64'), String(inline.mimeType ?? ''));
}

// Model sürümüne göre ya ham L16 PCM ya da WAV dönüyor; ikisini de düz PCM'e indir.
function decodeAudio(buf: Buffer, mimeType: string): Int16Array {
  let pcm = buf;
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF') {
    let off = 12;
    while (off + 8 <= buf.length) {
      const id = buf.subarray(off, off + 4).toString('ascii');
      const size = buf.readUInt32LE(off + 4);
      if (id === 'fmt ' && buf.readUInt32LE(off + 12) !== GEMINI_TTS_SAMPLE_RATE) throw new Error(`Beklenmeyen örnekleme hızı (${mimeType})`);
      if (id === 'data') { pcm = buf.subarray(off + 8, off + 8 + size); break; }
      off += 8 + size + (size % 2);
    }
  }
  const aligned = Buffer.from(pcm);
  return new Int16Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.length / 2));
}

export async function synthesizeSentence(text: string, opts: GeminiTtsOptions): Promise<Int16Array> {
  let lastError: unknown;
  // Anahtarlar sırayla denenir (biri kotayı doldurursa diğerine geçilir); hepsi düşerse beklenip tekrar.
  for (let round = 0; round < 4; round++) {
    for (const key of opts.apiKeys) {
      try {
        return await requestOnce(text, key, opts.model, opts.voice);
      } catch (err) {
        if (!(err instanceof RetryableError)) throw err;
        lastError = err;
      }
    }
    await sleep(15000 * (round + 1));
  }
  throw lastError;
}

// Ücretsiz katman kotası model başına günde ~10 istek (2026-10-01 ölçüldü) — cümle başına istek
// bir konuyu bile bitirmiyor. Bu yüzden birden çok cümle TEK istekte seslendirilip ses, cümle
// aralarındaki duraklamalardan bölünür. Bölme doğrulanamazsa null döner, çağıran tek tek üretir.
const MIN_GAP_SECONDS = 0.12;

function findSilenceGaps(pcm: Int16Array, threshold = 500): { mid: number; len: number }[] {
  const win = Math.round(GEMINI_TTS_SAMPLE_RATE * 0.01);
  const gaps: { mid: number; len: number }[] = [];
  let runStart = -1;
  for (let i = 0; i * win < pcm.length; i++) {
    let peak = 0;
    for (let j = i * win; j < Math.min(pcm.length, (i + 1) * win); j++) peak = Math.max(peak, Math.abs(pcm[j]));
    const quiet = peak < threshold;
    if (quiet && runStart < 0) runStart = i;
    if ((!quiet || (i + 1) * win >= pcm.length) && runStart >= 0) {
      const end = quiet ? i + 1 : i;
      const len = (end - runStart) / 100;
      if (len >= MIN_GAP_SECONDS) gaps.push({ mid: (runStart + end) / 200, len });
      runStart = -1;
    }
  }
  return gaps;
}

export async function synthesizeBatch(texts: string[], opts: GeminiTtsOptions): Promise<Int16Array[] | null> {
  if (texts.length === 1) return [trimSilence(await synthesizeSentence(texts[0], opts))];
  // Noktalamasız parçalar (başlıklar) cümle sonu duraklaması alsın diye nokta eklenir.
  const joined = texts.map((t) => (/[.!?;:]$/.test(t) ? t : `${t}.`)).join('\n\n');
  const pcm = trimSilence(await synthesizeSentence(joined, opts));
  const total = pcm.length / GEMINI_TTS_SAMPLE_RATE;
  const weights = texts.map((t) => t.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const expected: number[] = [];
  let acc = 0;
  for (let k = 0; k < texts.length - 1; k++) { acc += weights[k]; expected.push((acc / weightSum) * total); }
  // Kenarlardaki sessizlik sayılmaz (trimSilence sonrası kalan pay).
  const gaps = findSilenceGaps(pcm).filter((g) => g.mid > 0.3 && g.mid < total - 0.3);
  if (gaps.length < expected.length) return null;

  // DP: her cümle sınırına sırayla (artan) bir duraklama ata; skor = duraklama uzunluğu − beklenen
  // konumdan sapma cezası. Cümle sonu duraklamaları cümle içindekilerden belirgin uzun.
  const K = expected.length;
  const G = gaps.length;
  const score = (k: number, g: number) => gaps[g].len - 0.2 * Math.abs(gaps[g].mid - expected[k]);
  const best: number[][] = Array.from({ length: K }, () => new Array(G).fill(-Infinity));
  const prev: number[][] = Array.from({ length: K }, () => new Array(G).fill(-1));
  for (let g = 0; g < G; g++) best[0][g] = score(0, g);
  for (let k = 1; k < K; k++) {
    for (let g = k; g < G; g++) {
      for (let h = k - 1; h < g; h++) {
        const v = best[k - 1][h] + score(k, g);
        if (v > best[k][g]) { best[k][g] = v; prev[k][g] = h; }
      }
    }
  }
  let g = best[K - 1].indexOf(Math.max(...best[K - 1]));
  const cuts: number[] = new Array(K);
  for (let k = K - 1; k >= 0; k--) { cuts[k] = gaps[g].mid; g = prev[k][g]; }

  const bounds = [0, ...cuts, total];
  const pieces: Int16Array[] = [];
  for (let k = 0; k < texts.length; k++) {
    const dur = bounds[k + 1] - bounds[k];
    const expectedDur = (weights[k] / weightSum) * total;
    // Tahminden çok sapan parça = yanlış bölme (ör. bir cümle atlandı/eklendi) → güvenme.
    if (dur < expectedDur * 0.45 || dur > expectedDur * 2.2) return null;
    const from = Math.round(bounds[k] * GEMINI_TTS_SAMPLE_RATE);
    const to = Math.round(bounds[k + 1] * GEMINI_TTS_SAMPLE_RATE);
    pieces.push(trimSilence(pcm.subarray(from, to)));
  }
  return pieces;
}

// Baştaki/sondaki sessizliği kırpar (kısa pay bırakarak) — grup zamanlaması tahmini bu sayede
// cümlenin gerçek başlangıcına oturur, ekranlar arası geçişte de ölü bekleme kalmaz.
export function trimSilence(pcm: Int16Array, threshold = 500, padSeconds = 0.06): Int16Array {
  const pad = Math.round(padSeconds * GEMINI_TTS_SAMPLE_RATE);
  let start = 0;
  let end = pcm.length - 1;
  while (start < end && Math.abs(pcm[start]) < threshold) start++;
  while (end > start && Math.abs(pcm[end]) < threshold) end--;
  return pcm.subarray(Math.max(0, start - pad), Math.min(pcm.length, end + pad));
}
