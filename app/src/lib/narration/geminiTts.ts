// Gemini TTS motoru (2026-10-02'den beri yedek sağlayıcı; varsayılan Azure — bkz. azureTts.ts).
// Ücretsiz katman model başına proje başına günde ~10 istek: konu başına ~50 cümle için yetersiz.
// Birden çok cümleyi tek istekte seslendirip sessizlikten bölme denendi ve formüllü metinde
// yanlış böldüğü için kaldırıldı (2026-10-01).
// NOT: gemini-3.8-*-tts modelleri metne eklenen stil talimatını ("öğretmen gibi oku:") da sesli
// okuyor ve systemInstruction'ı reddediyor — bu yüzden istekte SADECE okunacak metin gönderiliyor.

import type { NarrationEngine } from './engine';
import { encodeMp3 } from './encodeMp3';
import { TTS_SAMPLE_RATE, trimSilence } from './pcm';

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
      if (id === 'fmt ' && buf.readUInt32LE(off + 12) !== TTS_SAMPLE_RATE) throw new Error(`Beklenmeyen örnekleme hızı (${mimeType})`);
      if (id === 'data') { pcm = buf.subarray(off + 8, off + 8 + size); break; }
      off += 8 + size + (size % 2);
    }
  }
  const aligned = Buffer.from(pcm);
  return new Int16Array(aligned.buffer, aligned.byteOffset, Math.floor(aligned.length / 2));
}

async function synthesizeSentence(text: string, opts: GeminiTtsOptions): Promise<Int16Array> {
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

export function createGeminiEngine(opts: GeminiTtsOptions): NarrationEngine {
  return {
    provider: 'gemini',
    model: opts.model,
    voice: opts.voice,
    trailingSilence: 0.06,
    synthesize: async (text) => {
      const pcm = trimSilence(await synthesizeSentence(text, opts));
      return { mp3: await encodeMp3(pcm, TTS_SAMPLE_RATE), duration: pcm.length / TTS_SAMPLE_RATE };
    },
  };
}
