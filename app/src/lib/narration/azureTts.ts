import type { NarrationEngine } from './engine';
import { mp3DurationSeconds } from './mp3';

// Azure Speech (REST) motoru. Ses doğrudan MP3 alınır — sunucuda kodlama yok (Vercel aktif CPU
// bütçesi). Elif MAI seslerinde baş sessizlik ~0, son sessizlik ~0.3 sn (2026-10-02 ölçüldü),
// kırpmaya gerek yok. MAI sesleri kelime zaman damgası vermiyor; senkron cümle başına ses +
// cümle içi tahmin (timing.ts).

// 2026-10-02 dinleme testinde seçildi: Elif HD; yanıt vermezse konunun TAMAMI Elif Flash.
export const AZURE_NARRATION_VOICES = ['tr-TR-Elif:MAI-Voice-2.1', 'tr-TR-Elif:MAI-Voice-2.1-Flash'];
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const TRAILING_SILENCE = 0.3;

type AzureOptions = { key: string; region: string; voice: string };

class RetryableError extends Error {
  constructor(message: string, readonly waitSeconds = 0) { super(message); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function requestOnce(text: string, opts: AzureOptions): Promise<Uint8Array> {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="tr-TR"><voice name="${escapeXml(opts.voice)}">${escapeXml(text)}</voice></speak>`;
  const res = await fetch(`https://${opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': opts.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'derstakip-narration',
    },
    body: ssml,
    cache: 'no-store',
  });
  // Ücretsiz katman dakikada ~20 istek; 429'da Retry-After kadar beklenir.
  if (res.status === 429 || res.status >= 500) throw new RetryableError(`Azure TTS ${res.status}`, Number(res.headers.get('retry-after')) || 0);
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const mp3 = new Uint8Array(await res.arrayBuffer());
  if (mp3.length < 200) throw new RetryableError('Azure TTS boş ses döndü');
  return mp3;
}

async function synthesize(text: string, opts: AzureOptions): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await requestOnce(text, opts);
    } catch (err) {
      if (!(err instanceof RetryableError)) throw err;
      lastError = err;
      await sleep(err.waitSeconds ? err.waitSeconds * 1000 : 4000 * (attempt + 1));
    }
  }
  throw lastError;
}

// Sesler sırayla kısa bir denemeyle sınanır; yanıt veren ilk ses konunun sonuna kadar kullanılır
// (bir konu içinde ses asla karışmaz).
export async function createAzureEngine(key: string, region: string, voices = AZURE_NARRATION_VOICES): Promise<NarrationEngine> {
  const errors: string[] = [];
  for (const voice of voices) {
    const opts = { key, region, voice };
    try {
      await synthesize('Merhaba.', opts);
    } catch (err) {
      errors.push(`${voice}: ${(err as Error).message}`);
      continue;
    }
    return {
      provider: 'azure',
      model: voice.split(':')[1] ?? 'neural',
      voice,
      trailingSilence: TRAILING_SILENCE,
      synthesize: async (text) => {
        const mp3 = await synthesize(text, opts);
        return { mp3, duration: mp3DurationSeconds(mp3) };
      },
    };
  }
  throw new Error(`Hiçbir Azure sesi yanıt vermedi — ${errors.join(' | ')}`);
}
