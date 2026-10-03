// Tek bir alt başlığa elle soru taslağı üretir (normalde soru worker'ları yapar: aiQuestionDraftGen.ts).
// Worker'ın uygunluk şartlarını atlar — yeni bir dersin soru şablonunu ders kapalıyken denemek için.
// Taslak 'pending' kaydedilir; yönetim panelinde "AI Soru Taslakları"ndan onaylanınca soru olur.
//
// Kullanım:
//   npx tsx scripts/generate-section-questions.ts 1725 --dry-run   (sadece prompt'u yazdırır)
//   npx tsx scripts/generate-section-questions.ts 1725             (primary soru profiliyle üretir)
//   ... --all-keys                                                 (tanımlı tüm Gemini key'lerini sırayla dener)
//   ... --models=gemini-3.7-flash,gemini-3.5-flash                 (profilin modelleri yerine bu sırayla dener)

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { generateQuestionDraftForSectionId } from '../app/src/lib/aiQuestionDraftGen';
import { QUESTION_WORKER_PROFILES } from '../app/src/lib/questionWorkerProfiles';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !(m[1].trim() in process.env)) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

const sectionId = Number(process.argv[2]);
if (!Number.isInteger(sectionId) || sectionId <= 0) {
  console.error('Kullanım: npx tsx scripts/generate-section-questions.ts <sectionId> [--dry-run] [--all-keys] [--models=a,b]');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const ALL_GEMINI_KEY_ENVS = ['GEMINI_API_KEY_QUESTIONS', 'NEW_GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY_CONTENT', 'GEMINI_API_KEY'];
const modelsArg = process.argv.find((a) => a.startsWith('--models='))?.slice('--models='.length).split(',').filter(Boolean);
const profile = {
  ...QUESTION_WORKER_PROFILES.primary,
  ...(process.argv.includes('--all-keys') ? { apiKeyEnvs: ALL_GEMINI_KEY_ENVS } : {}),
  ...(modelsArg?.length ? { model: modelsArg[0], fallbackModels: modelsArg.slice(1) } : {}),
};

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const result = await generateQuestionDraftForSectionId(supabase, sectionId, profile, { dryRun });
  if (dryRun) console.log(result.prompt ?? result.reason);
  else console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
