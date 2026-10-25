// Yayındaki bir konunun alt başlıklarına hap bilgi kartı üretir (bkz. app/src/lib/recapCardsGen.ts).
// Bölümlerin anlatımı/soruları/görselleri değişmez, yalnız topic_content_sections.recap_card yazılır
// (varsa üzerine yazılır).
//
// Kullanım:
//   npx tsx scripts/generate-recap-cards.ts 721 --dry-run   (sadece prompt'u yazdırır, Gemini'ye gitmez)
//   npx tsx scripts/generate-recap-cards.ts 721 --no-save   (üretir, kartları yazdırır, DB'ye yazmaz)
//   npx tsx scripts/generate-recap-cards.ts 721             (üretir + kaydeder)
// Yalnız içerik worker'ının anahtarı kullanılır: soru anahtarları soru üretimine ayrılmış, öğrenci sohbet
// anahtarı (GEMINI_API_KEY) hiçbir toplu işte kullanılmaz (kullanıcının 2026-10-24 kuralı).

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { generateRecapCardsForTopic } from '../app/src/lib/recapCardsGen';
import { CONTENT_WORKER_PROFILES } from '../app/src/lib/contentWorkerProfiles';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const topicId = Number(process.argv[2]);
if (!Number.isInteger(topicId) || topicId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-recap-cards.ts <topicId> [--dry-run | --no-save]');
  process.exit(1);
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const result = await generateRecapCardsForTopic(supabase, topicId, CONTENT_WORKER_PROFILES.primary, {
    dryRun: process.argv.includes('--dry-run'),
    save: !process.argv.includes('--no-save'),
  });
  if (result.prompt) console.log(result.prompt);
  else console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
