// Tek bir konunun ders notunu elle üretir (normalde içerik worker'ı yapar: aiContentDraftGen.ts).
// Worker'ın uygunluk şartlarını atlar — yeni bir dersin şablonunu ders kapalıyken denemek için.
// Üretilen içerik worker'daki gibi otomatik yayınlanır (topic_contents); ders kapalıysa öğrenci görmez.
//
// Kullanım:
//   npx tsx scripts/generate-topic-content.ts 939 --dry-run   (sadece prompt'u yazdırır, Gemini'ye gitmez)
//   npx tsx scripts/generate-topic-content.ts 939             (primary içerik profiliyle üretir + yayınlar)
//   npx tsx scripts/generate-topic-content.ts 939 --all-keys  (tanımlı tüm Gemini key'lerini sırayla dener —
//                                                              diğer worker'ların kotasından da yer, elle deneme için)
//   ... --models=gemini-3.7-flash,gemini-3.5-flash             (profilin modelleri yerine bu sırayla dener)

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { generateContentDraftForTopicId } from '../app/src/lib/aiContentDraftGen';
import { CONTENT_WORKER_PROFILES } from '../app/src/lib/contentWorkerProfiles';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const topicId = Number(process.argv[2]);
if (!Number.isInteger(topicId) || topicId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-topic-content.ts <topicId> [--dry-run]');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const ALL_GEMINI_KEY_ENVS = ['GEMINI_API_KEY_CONTENT', 'NEW_GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY_QUESTIONS', 'GEMINI_API_KEY'];
const modelsArg = process.argv.find((a) => a.startsWith('--models='))?.slice('--models='.length).split(',').filter(Boolean);
const profile = {
  ...CONTENT_WORKER_PROFILES.primary,
  ...(process.argv.includes('--all-keys') ? { apiKeyEnvs: ALL_GEMINI_KEY_ENVS } : {}),
  ...(modelsArg?.length ? { model: modelsArg[0], fallbackModels: modelsArg.slice(1) } : {}),
};

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  const { count } = await supabase.from('topic_contents').select('id', { count: 'exact', head: true }).eq('topic_id', topicId);
  if (count && !dryRun) {
    console.error(`Konu ${topicId} için zaten içerik var — üzerine yazılmaz. Önce yönetim panelinden kaldır.`);
    return void (process.exitCode = 1);
  }

  const result = await generateContentDraftForTopicId(supabase, topicId, profile, { dryRun });
  if (dryRun) console.log(result.prompt ?? result.reason);
  else console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
