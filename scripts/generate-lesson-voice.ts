// Etkileşimli dersin anlatıcı robotu (Atom) için sesleri elle üretir (normalde etkileşimli ders worker'ı
// üretilen derslerin seslerini kendisi üretir). Üretim mantığı app/src/lib/interactiveLesson/voice.ts'te.
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/generate-lesson-voice.ts 704 817 818 881 [--redo=<regex>]
// --redo: deseni içeren cümleler, sesi olsa da yeniden üretilir (okunuş düzeltmesinden sonra, ör. --redo=[âîû]).
// (react-server koşulu: ders verisi sunucu modüllerinden — 'server-only' — okunuyor.)
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const { voiceLesson } = await import('../app/src/lib/interactiveLesson/voice');
  const redoArg = process.argv.find((a) => a.startsWith('--redo='))?.slice('--redo='.length);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  const topicIds = process.argv.slice(2).filter((a) => !a.startsWith('--')).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!topicIds.length) throw new Error('Kullanım: npx tsx scripts/generate-lesson-voice.ts <topicId> [topicId…]');

  for (const topicId of topicIds) {
    const r = await voiceLesson(supabase, topicId, { redo: redoArg ? new RegExp(redoArg, 'u') : null });
    console.log(`${topicId}: ${r.lines} cümle, ${r.made} yeni ses`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
