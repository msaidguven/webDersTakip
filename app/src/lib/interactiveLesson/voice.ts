import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hydrateLesson } from './hydrate';
import { lessonLines, ttsText, voiceAudioPath, voiceKey, voiceManifestPath, VOICE_BUCKET } from './guide';

// Atom'un seslerini üretir (Azure): dersin bütün cümleleri içerik adresli olarak yüklenir (aynı cümle bütün
// derslerde tek dosya, var olan yeniden üretilmez), hepsi tamamlanınca konunun ses listesi yazılır.
// deadlineAt verilirse (worker) süre bitince durur, kalanlar sonraki çalışmada üretilir.
// Kullananlar: scripts/generate-lesson-voice.ts ve etkileşimli ders worker'ı (worker.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export const LESSON_VOICE = 'tr-TR-EmelNeural';
// Ücretsiz Azure katmanı dakikada ~20 istek.
const REQUEST_GAP_MS = 3200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function synthesize(text: string): Promise<Uint8Array> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('AZURE_SPEECH_KEY / AZURE_SPEECH_REGION tanımlı değil');
  // Neşeli, biraz ince ve hızlı ses: çocuklara yönelik robot karakteri (prototipte onaylanan ayar).
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="tr-TR"><voice name="${LESSON_VOICE}"><mstts:silence type="Leading-exact" value="0ms"/><mstts:silence type="Tailing-exact" value="150ms"/><mstts:express-as style="cheerful"><prosody pitch="+12%" rate="+6%">${esc(text)}</prosody></mstts:express-as></voice></speak>`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'derstakip-lesson-voice' },
      body: ssml,
    });
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 200) return buf;
    } else if (res.status !== 429 && res.status < 500) {
      throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    await sleep(6000 * (attempt + 1));
  }
  throw new Error(`Azure ses üretemedi: ${text.slice(0, 60)}`);
}

export type VoiceResult = { lines: number; made: number; done: boolean };

export async function voiceLesson(supabase: Supabase, topicId: number, opts: { deadlineAt?: number; redo?: RegExp | null } = {}): Promise<VoiceResult> {
  const result = await hydrateLesson(topicId, { includeUnvoiced: true });
  if ('error' in result) throw new Error(result.error);
  const lines = lessonLines(result.lesson);
  const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VOICE_BUCKET}/${path}`;
  let made = 0;
  for (const text of lines) {
    // Bir sentez + yükleme + bekleme ~6 sn; süre yetmeyecekse dur (Vercel 300 sn sınırı).
    if (opts.deadlineAt && Date.now() > opts.deadlineAt - 10_000) return { lines: lines.length, made, done: false };
    const key = voiceKey(text);
    if (!opts.redo?.test(text) && (await fetch(publicUrl(voiceAudioPath(key)), { method: 'HEAD' })).ok) continue;
    const mp3 = await synthesize(ttsText(text));
    const { error } = await supabase.storage.from(VOICE_BUCKET).upload(voiceAudioPath(key), mp3, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: true });
    if (error) throw new Error(`Ses yüklenemedi: ${error.message}`);
    made++;
    await sleep(REQUEST_GAP_MS);
  }
  const { error } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(voiceManifestPath(topicId), JSON.stringify({ voice: LESSON_VOICE, keys: lines.map(voiceKey) }), { contentType: 'application/json', cacheControl: '60', upsert: true });
  if (error) throw new Error(`Ses listesi yazılamadı: ${error.message}`);
  return { lines: lines.length, made, done: true };
}
