// Hazır AI derslerinin anlatım ekranlarına Wikimedia Commons'tan serbest lisanslı fotoğraf ekler (bkz. photos.ts).
// Varsayılan kuru çalışma (yalnız yazdırır); --save veritabanına yazar. --redo var olan fotoğrafları da yeniden seçer.
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/add-lesson-photos.ts <topicId…> [--save] [--redo] [--key=ENV_ADI] [--model=gemini-…] [--out=klasör]
import { readFileSync, writeFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  if (!ids.length) throw new Error('Kullanım: add-lesson-photos.ts <topicId…> [--save] [--redo] [--key=ENV_ADI] [--model=…]');
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const keyEnv = arg('key');
  const model = arg('model');
  const { createClient } = await import('@supabase/supabase-js');
  const { QUESTION_WORKER_PROFILES } = await import('../app/src/lib/questionWorkerProfiles');
  const { addLessonPhotos } = await import('../app/src/lib/interactiveLesson/photos');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  for (const topicId of ids) {
    const { data: row, error } = await supabase.from('interactive_lessons').select('lesson, topics(title, units(grades(name), lessons(name)))').eq('topic_id', topicId).maybeSingle();
    if (error) throw new Error(error.message);
    const stored = row?.lesson as { blocks?: unknown[] } | null;
    if (!stored?.blocks?.length) {
      console.log(`${topicId}: ders yok, atlandı`);
      continue;
    }
    const t = row!.topics as unknown as { title: string; units: { grades: { name: string }; lessons: { name: string } } };
    const profile = { ...QUESTION_WORKER_PROFILES.secondary, ...(keyEnv ? { apiKeyEnvs: [keyEnv] } : {}), ...(model ? { model } : {}), requestTimeoutMs: 120_000, deadlineAt: Date.now() + 280_000 };
    const out = await addLessonPhotos({ topicId, ...(stored as object) } as never, { title: t.title, grade: t.units.grades.name, lesson: t.units.lessons.name }, profile, { redo: process.argv.includes('--redo') });
    console.log(`\n${topicId} "${t.title}": ${out.added.length} fotoğraf`);
    out.added.forEach((a) => console.log(`  + ${a}`));
    out.skipped.forEach((s) => console.log(`  - ${s} (uygun fotoğraf yok)`));
    if (arg('out')) writeFileSync(`${arg('out')}/${topicId}.json`, JSON.stringify(out.lesson));
    if (process.argv.includes('--save') && out.added.length) {
      const { topicId: _omit, ...lesson } = out.lesson;
      void _omit;
      const { error: upErr } = await supabase.from('interactive_lessons').update({ lesson, updated_at: new Date().toISOString() }).eq('topic_id', topicId);
      if (upErr) throw new Error(upErr.message);
      console.log('  kaydedildi');
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
