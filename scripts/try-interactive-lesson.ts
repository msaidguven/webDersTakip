// Etkileşimli ders üretimini tek konuda dener (worker'ın aynısı: aynı kaynak, istem, profil ve denetim).
// Varsayılan kuru çalışma: sonucu yazdırır, veritabanına yazmaz. --save: geçerse interactive_lessons'a 'ready'
// olarak kaydeder (sesleri worker sonra üretir).
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/try-interactive-lesson.ts <topicId> [--save]
import { readFileSync, writeFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const topicId = Number(process.argv[2]);
  if (!Number.isInteger(topicId) || topicId <= 0) throw new Error('Kullanım: npx tsx scripts/try-interactive-lesson.ts <topicId> [--save]');
  const { createClient } = await import('@supabase/supabase-js');
  const { QUESTION_WORKER_PROFILES } = await import('../app/src/lib/questionWorkerProfiles');
  const { loadLessonSource, produceLesson } = await import('../app/src/lib/interactiveLesson/generate');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  const source = await loadLessonSource(supabase, topicId);
  if ('error' in source) throw new Error(source.error);
  console.log(`"${source.title}" · ${source.sections.length} bölüm · ${source.terms.length} kavram`);
  const started = Date.now();
  // Worker'la aynı süre bütçesi (düzeltme turları buna göre).
  // Worker gibi ilk parça (ilk alt konu); --save yalnız tüm bölümler tek parçaya sığdıysa.
  const { SECTIONS_PER_CALL } = await import('../app/src/lib/interactiveLesson/generate');
  const chunk = { ...source, sections: source.sections.slice(0, SECTIONS_PER_CALL) };
  const out = await produceLesson(chunk, { ...QUESTION_WORKER_PROFILES.secondary, requestTimeoutMs: 230_000, deadlineAt: Date.now() + 250_000 }, undefined, { first: true, of: source.sections.length });
  const { lesson, errors } = out;
  console.log(`${out.model} · ${out.calls} AI çağrısı · ${Math.round((Date.now() - started) / 1000)} sn`);
  const file = `/tmp/interactive-lesson-${topicId}.json`;
  writeFileSync(file, JSON.stringify(lesson, null, 1));
  console.log(`Ders: ${file}`);
  for (const b of lesson.blocks) console.log(`- ${b.title}: ${b.steps.map((s) => s.kind).join(' → ')}`);
  console.log(errors.length ? `DENETİM HATALARI (${errors.length}):\n${errors.join('\n')}` : 'Denetimden geçti.');
  if (!errors.length && process.argv.includes('--save') && chunk.sections.length === source.sections.length) {
    const { topicId: _omit, ...stored } = lesson;
    void _omit;
    const { error } = await supabase.from('interactive_lessons').upsert({ topic_id: topicId, status: 'ready', lesson: stored, model: out.model, runs: 1, voice_done: false, last_message: 'elle denendi', updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    console.log('Kaydedildi (ready).');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
