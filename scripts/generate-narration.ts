// "Video / Sesli Anlatım" üretici (PROTOTİP, 2026-10-01).
// Konunun alt başlık metinlerini ekranlara böler, her ekranı Gemini TTS ile seslendirip MP3 olarak
// Storage'a yükler, oynatıcının okuyacağı manifesti yazar. Ses dosyaları seslendirilen metnin
// hash'iyle adlandırıldığından tekrar çalıştırmak yalnızca DEĞİŞEN cümleleri yeniden üretir.
//
// Kullanım:
//   npx tsx scripts/generate-narration.ts 567 --dry-run      (sadece ekran/grup bölmesini yazdırır)
//   npx tsx scripts/generate-narration.ts 567 [--voice=Charon] [--model=gemini-3.8-flash-lite-tts]
//     --force-section=4,5   bu bölümlerin sesini önbelleğe bakmadan yeniden üret (1'den başlar)
//     --batch               ücretsiz kota idaresi: bölümü tek istekte seslendirip sessizlikten böler.
//                           Formül/sayı ağırlıklı metinde cümle içi duraklamalar cümle sonu kadar uzun
//                           olabildiği için YANLIŞ bölebilir (2026-10-01'de 5. bölümde oldu) —
//                           sonrasında dinleyip kontrol et. Varsayılan: cümle başına istek (kesin).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildNarrationScript, type ScriptSourceSection } from '../app/src/lib/narration/buildScript';
import { estimateChunkStarts } from '../app/src/lib/narration/timing';
import { GEMINI_TTS_SAMPLE_RATE, synthesizeBatch, synthesizeSentence, trimSilence } from '../app/src/lib/narration/geminiTts';
import { encodeMp3 } from '../app/src/lib/narration/encodeMp3';
import { NARRATION_BUCKET, narrationAudioPath, narrationManifestPath } from '../app/src/lib/narration/config';
import { NARRATION_MANIFEST_VERSION, type NarrationManifest, type NarrationScreen, type NarrationSection } from '../app/src/lib/narration/types';

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const topicId = Number(process.argv[2]);
const DRY_RUN = process.argv.includes('--dry-run');
// Ücretsiz katmanda model başına günde ~10 istek var; flash ve flash-lite kotaları ayrı.
const MODEL = arg('model') ?? 'gemini-3.8-flash-lite-tts';
const VOICE = arg('voice') ?? 'Charon';
const BATCH = process.argv.includes('--batch');
const FORCE_SECTIONS = new Set((arg('force-section') ?? '').split(',').filter(Boolean).map(Number));

if (!Number.isInteger(topicId) || topicId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-narration.ts <topicId> [--dry-run] [--voice=X] [--model=Y]');
  process.exit(1);
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const apiKeys = [env.GEMINI_API_KEY, env.NEW_GEMINI_API_KEY_CONTENT, env.GEMINI_API_KEY_CONTENT, env.GEMINI_API_KEY_QUESTIONS].filter(Boolean);
const MAX_BATCH_SCREENS = 14;
const MAX_BATCH_CHARS = 1500;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(NARRATION_BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(NARRATION_BUCKET, {
    public: true,
    allowedMimeTypes: ['audio/mpeg', 'application/json'],
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error) throw error;
  console.log(`Bucket oluşturuldu: ${NARRATION_BUCKET}`);
}

async function audioExists(path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await supabase.storage.from(NARRATION_BUCKET).list(dir, { search: name });
  return !!data?.some((f) => f.name === name);
}

// Önceki manifestteki sesler ekran kimliğiyle (seslendirilen metin + model + ses hash'i) eşlenir;
// dosya hâlâ duruyorsa yeniden üretilmez. Ses dosyaları hiçbir zaman üzerine yazılmaz (yeni üretim
// = yeni dosya adı), çünkü bir yıllık CDN önbelleğiyle sunuluyorlar.
async function loadPreviousAudio(): Promise<Map<string, NarrationScreen['audio']>> {
  const { data } = await supabase.storage.from(NARRATION_BUCKET).download(narrationManifestPath(topicId));
  const map = new Map<string, NarrationScreen['audio']>();
  if (!data) return map;
  try {
    const prev = JSON.parse(await data.text()) as NarrationManifest;
    for (const sec of prev.sections) for (const sc of sec.screens) map.set(sc.id, sc.audio);
  } catch { /* bozuk/eski manifest — hepsi yeniden üretilir */ }
  return map;
}

async function main() {
  const { data: topic, error: topicErr } = await supabase.from('topics').select('id, title').eq('id', topicId).single();
  if (topicErr || !topic) throw new Error(`Konu bulunamadı: ${topicId}`);
  const { data: tc } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).single();
  if (!tc) throw new Error('Konunun içeriği (topic_contents) yok');
  const { data: rows, error } = await supabase
    .from('topic_content_sections')
    .select('id, heading, body_markdown')
    .eq('topic_content_id', tc.id)
    .order('order_no', { ascending: true });
  if (error) throw error;
  const source = (rows ?? []) as ScriptSourceSection[];
  const script = buildNarrationScript(source);

  if (DRY_RUN) {
    for (const sec of script) {
      console.log(`\n=== ${sec.title}`);
      for (const sc of sec.screens) {
        console.log(`[${sc.kind}${sc.eyebrow ? ` · ${sc.eyebrow}` : ''}] ${sc.chunks.map((c) => c.words.map((w) => (w.em ? `*${w.t}*` : w.t)).join(' ')).join(' | ')}`);
        if (sc.speech !== sc.chunks.map((c) => c.words.map((w) => w.t).join(' ')).join(' ')) console.log(`    🔊 ${sc.speech}`);
      }
    }
    const total = script.reduce((n, s) => n + s.screens.length, 0);
    const chars = script.reduce((n, s) => n + s.screens.reduce((m, sc) => m + sc.speech.length, 0), 0);
    console.log(`\n${total} ekran, ${chars} seslendirilecek karakter`);
    return;
  }

  await ensureBucket();
  const previous = await loadPreviousAudio();
  const sections: NarrationSection[] = [];
  let made = 0;
  let reused = 0;

  for (const [secIndex, sec] of script.entries()) {
    const force = FORCE_SECTIONS.has(secIndex + 1);
    const items = sec.screens.map((sc) => {
      const hash = sha(`${MODEL}|${VOICE}|${sc.speech}`);
      return { sc, hash, id: hash.slice(0, 16), path: '', duration: undefined as number | undefined };
    });
    const missing: typeof items = [];
    for (const it of items) {
      const prev = previous.get(it.id);
      if (!force && prev && (await audioExists(prev.path))) {
        it.path = prev.path;
        it.duration = prev.duration;
        reused++;
      } else {
        it.path = narrationAudioPath(`${it.hash}-${Date.now().toString(36)}`);
        missing.push(it);
      }
    }

    // Eksik ekranlar bölüm içinde toplu seslendirilir (kota: bkz. synthesizeBatch).
    for (let b = 0; b < missing.length;) {
      const batch: typeof items = [];
      let chars = 0;
      while (b < missing.length && batch.length < MAX_BATCH_SCREENS && (batch.length === 0 || chars + missing[b].sc.speech.length <= MAX_BATCH_CHARS)) {
        chars += missing[b].sc.speech.length;
        batch.push(missing[b++]);
      }
      const opts = { apiKeys, model: MODEL, voice: VOICE };
      let pieces = BATCH ? await synthesizeBatch(batch.map((it) => it.sc.speech), opts) : null;
      if (!pieces) {
        if (BATCH) console.warn(`⚠️  Toplu ses bölünemedi (${batch.length} ekran), tek tek üretiliyor`);
        pieces = [];
        for (const it of batch) pieces.push(trimSilence(await synthesizeSentence(it.sc.speech, opts)));
      }
      for (let k = 0; k < batch.length; k++) {
        const it = batch[k];
        it.duration = Math.round((pieces[k].length / GEMINI_TTS_SAMPLE_RATE) * 100) / 100;
        const mp3 = await encodeMp3(pieces[k], GEMINI_TTS_SAMPLE_RATE);
        const { error: upErr } = await supabase.storage
          .from(NARRATION_BUCKET)
          .upload(it.path, mp3, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
        if (upErr) throw upErr;
        made++;
        console.log(`🔊 ${it.duration.toFixed(1)}s  ${it.sc.speech.slice(0, 70)}`);
      }
    }

    const screens: NarrationSection['screens'] = items.map(({ sc, id, path, duration }) => {
      const starts = estimateChunkStarts(sc.chunks.map((c) => c.speech), duration!);
      return {
        id,
        kind: sc.kind,
        eyebrow: sc.eyebrow,
        chunks: sc.chunks.map((c, i) => ({ parts: c.words.map((w) => (w.em ? { t: w.t, em: true as const } : { t: w.t })), start: starts[i] })),
        audio: { path, duration: duration! },
      };
    });
    sections.push({ sectionId: sec.sectionId, title: sec.title, screens });
  }

  const manifest: NarrationManifest = {
    version: NARRATION_MANIFEST_VERSION,
    topicId,
    topicTitle: topic.title,
    sourceHash: sha(JSON.stringify(source.map((s) => [s.id, s.heading, s.body_markdown]))).slice(0, 16),
    voice: { provider: 'gemini', model: MODEL, voice: VOICE },
    generatedAt: new Date().toISOString(),
    sections,
  };
  const { error: mErr } = await supabase.storage
    .from(NARRATION_BUCKET)
    .upload(narrationManifestPath(topicId), JSON.stringify(manifest), { contentType: 'application/json', cacheControl: '60', upsert: true });
  if (mErr) throw mErr;
  const seconds = sections.reduce((n, s) => n + s.screens.reduce((m, sc) => m + sc.audio.duration, 0), 0);
  console.log(`\nTamam: ${made} yeni, ${reused} önbellekten, toplam ${(seconds / 60).toFixed(1)} dk anlatım`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
