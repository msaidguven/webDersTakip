// Hazır AI derslerinin anlatım ekranlarına görseli yeni türlerle (denklem/döngü/merkez/karşılaştır/çubuk) yeniden
// seçtirir; metin ve sorular aynen kalır (bkz. revisualizeLesson). Varsayılan kuru çalışma; --save veritabanına yazar.
// Kaydettikten sonra değişen görsel cümlelerinin sesi: scripts/generate-lesson-voice.ts <id…>.
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/revisualize-interactive-lessons.ts <topicId…> [--save] [--key=ENV_ADI] [--model=gemini-…]
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  if (!ids.length) throw new Error('Kullanım: revisualize-interactive-lessons.ts <topicId…> [--save] [--key=ENV_ADI]');
  const save = process.argv.includes('--save');
  const keyEnv = process.argv.find((a) => a.startsWith('--key='))?.slice(6);
  const model = process.argv.find((a) => a.startsWith('--model='))?.slice(8);
  const { createClient } = await import('@supabase/supabase-js');
  const { QUESTION_WORKER_PROFILES } = await import('../app/src/lib/questionWorkerProfiles');
  const { revisualizeLesson } = await import('../app/src/lib/interactiveLesson/generate');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });

  for (const topicId of ids) {
    const { data: row, error } = await supabase
      .from('interactive_lessons')
      .select('lesson, topics(title, units(grades(name), lessons(name)))')
      .eq('topic_id', topicId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const stored = row?.lesson as { blocks?: unknown[] } | null;
    if (!stored?.blocks?.length) {
      console.log(`${topicId}: ders yok, atlandı`);
      continue;
    }
    const t = row!.topics as unknown as { title: string; units: { grades: { name: string }; lessons: { name: string } } };
    const started = Date.now();
    const profile = { ...QUESTION_WORKER_PROFILES.secondary, ...(keyEnv ? { apiKeyEnvs: [keyEnv] } : {}), ...(model ? { model } : {}), requestTimeoutMs: 230_000, deadlineAt: Date.now() + 280_000 };
    const out = await revisualizeLesson({ topicId, ...(stored as object) } as never, { title: t.title, grade: t.units.grades.name, lesson: t.units.lessons.name }, profile);
    console.log(`\n${topicId} "${t.title}" · ${out.calls} AI çağrısı · ${Math.round((Date.now() - started) / 1000)} sn · ${out.changed.length} görsel değişti`);
    out.changed.forEach((c) => console.log(`  ${c}`));
    if (out.errors.length) console.log(`  Eski görselinde kalan ekranlar:\n  ${out.errors.join('\n  ')}`);
    if (save && out.changed.length) {
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
