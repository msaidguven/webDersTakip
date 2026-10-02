// "Video / Sesli Anlatım" — bir konuyu elle seslendirme (normalde saatlik worker yapar:
// app/api/narration/worker). Üretim mantığı app/src/lib/narration/generateTopicNarration.ts'te.
//
// Kullanım:
//   npx tsx scripts/generate-narration.ts 567 --dry-run      (sadece ekran/grup bölmesini yazdırır)
//   npx tsx scripts/generate-narration.ts 567                (Azure, varsayılan ses: azureTts.ts AZURE_NARRATION_VOICES)
//     (--voice yoksa konunun mevcut sesi korunur; hiç anlatımı yoksa varsayılan ses)
//     --voice=tr-TR-EmelNeural               belirli bir Azure sesi
//     --force-section=4,5                      bu bölümleri önbelleğe bakmadan yeniden seslendir
//     --provider=gemini [--voice=Charon] [--model=gemini-3.8-flash-lite-tts]   (ücretsiz kota ~10 istek/gün)

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildNarrationScript } from '../app/src/lib/narration/buildScript';
import { createAzureEngine } from '../app/src/lib/narration/azureTts';
import { createGeminiEngine } from '../app/src/lib/narration/geminiTts';
import { generateTopicNarration, loadNarrationSource } from '../app/src/lib/narration/generateTopicNarration';
import type { NarrationEngine } from '../app/src/lib/narration/engine';
import { NARRATION_BUCKET, narrationManifestPath } from '../app/src/lib/narration/config';
import type { NarrationManifest } from '../app/src/lib/narration/types';

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) vars[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return vars;
}

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const topicId = Number(process.argv[2]);
if (!Number.isInteger(topicId) || topicId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-narration.ts <topicId> [--dry-run] [--voice=X] [--force-section=N] [--provider=gemini]');
  process.exit(1);
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

async function pickEngine(): Promise<NarrationEngine> {
  if (arg('provider') === 'gemini') {
    return createGeminiEngine({
      apiKeys: [env.GEMINI_API_KEY, env.NEW_GEMINI_API_KEY_CONTENT, env.GEMINI_API_KEY_CONTENT, env.GEMINI_API_KEY_QUESTIONS].filter(Boolean),
      model: arg('model') ?? 'gemini-3.8-flash-lite-tts',
      voice: arg('voice') ?? 'Charon',
    });
  }
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) throw new Error('.env.local: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION eksik');
  // --voice verilmediyse konunun MEVCUT sesi korunur (okunuş kuralı düzeltmelerinde eski Elif konuları
  // Ahmet'e dönmesin, sadece değişen cümleler aynı sesle yeniden üretilsin — 2026-10-03). Anlatımı hiç
  // olmayan konu varsayılan sesi (AZURE_NARRATION_VOICES) alır.
  const voice = arg('voice') ?? (await existingAzureVoice());
  return createAzureEngine(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION, voice ? [voice] : undefined);
}

async function existingAzureVoice(): Promise<string | null> {
  const { data } = await supabase.storage.from(NARRATION_BUCKET).download(narrationManifestPath(topicId));
  if (!data) return null;
  try {
    const manifest = JSON.parse(await data.text()) as NarrationManifest;
    return manifest.voice.provider === 'azure' ? manifest.voice.voice : null;
  } catch {
    return null;
  }
}

async function main() {
  if (process.argv.includes('--dry-run')) {
    const { sections } = await loadNarrationSource(supabase, topicId);
    const script = buildNarrationScript(sections);
    for (const sec of script) {
      console.log(`\n=== ${sec.title}`);
      for (const sc of sec.screens) {
        const shown = sc.chunks.map((c) => c.words.map((w) => w.t).join(' ')).join(' ');
        console.log(`[${sc.kind}${sc.eyebrow ? ` · ${sc.eyebrow}` : ''}] ${sc.chunks.map((c) => c.words.map((w) => (w.em ? `*${w.t}*` : w.t)).join(' ')).join(' | ')}`);
        if (sc.speech !== shown) console.log(`    🔊 ${sc.speech}`);
      }
    }
    const screens = script.reduce((n, s) => n + s.screens.length, 0);
    const chars = script.reduce((n, s) => n + s.screens.reduce((m, sc) => m + sc.speech.length, 0), 0);
    console.log(`\n${screens} ekran, ${chars} seslendirilecek karakter`);
    return;
  }

  const engine = await pickEngine();
  console.log(`Ses: ${engine.provider} · ${engine.voice}`);
  const forceSections = new Set((arg('force-section') ?? '').split(',').filter(Boolean).map(Number));
  const result = await generateTopicNarration(supabase, topicId, engine, {
    forceSections,
    onScreen: ({ duration, speech }) => console.log(`🔊 ${duration.toFixed(1)}s  ${speech.slice(0, 70)}`),
  });
  console.log(`\nTamam: ${result.made} yeni, ${result.reused} önbellekten, toplam ${((result.durationSeconds ?? 0) / 60).toFixed(1)} dk anlatım`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
