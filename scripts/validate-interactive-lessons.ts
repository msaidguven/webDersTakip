// Elle yazılmış etkileşimli dersleri şablon sınırlarına ve kavram bağlarına göre denetler:
//   npx tsx scripts/validate-interactive-lessons.ts
// Kavram bağları için konunun anahtar kavramları (topic_content_highlights) canlı veritabanından okunur.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { validateLesson } from '../app/src/lib/interactiveLesson/templates';
import { termSlug } from '../app/src/lib/interactiveLesson/types';
import { isLessonV3 } from '../app/src/lib/interactiveLesson/typesV3';
import { isLessonV2 } from '../app/src/lib/interactiveLesson/typesV2';
import { lesson704 } from '../app/src/lib/interactiveLesson/lessons/704';
import { lesson817 } from '../app/src/lib/interactiveLesson/lessons/817';
import { lesson818 } from '../app/src/lib/interactiveLesson/lessons/818';
import { lesson861 } from '../app/src/lib/interactiveLesson/lessons/861';
import { lesson881 } from '../app/src/lib/interactiveLesson/lessons/881';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

async function main() {
  let failed = false;
  for (const lesson of [lesson704, lesson817, lesson818, lesson861, lesson881]) {
    if (isLessonV2(lesson) || isLessonV3(lesson)) {
      console.log(`Konu ${lesson.topicId}: v${lesson.version} dersi (v1 şablon kontrolü atlandı)`);
      continue;
    }
    const { data, error } = await supabase
      .from('topic_content_highlights')
      .select('title, topic_contents!inner(topic_id, is_published)')
      .eq('topic_contents.topic_id', lesson.topicId)
      .eq('topic_contents.is_published', true);
    if (error) throw error;
    const problems = validateLesson(lesson, (data ?? []).map((h) => termSlug(h.title)));
    console.log(`Konu ${lesson.topicId}: ${problems.length ? `${problems.length} sorun` : 'sınırlara ve kavram bağlarına uyuyor'}`);
    problems.forEach((p) => console.log(`  - ${p}`));
    failed ||= problems.length > 0;
  }
  process.exit(failed ? 1 : 0);
}

main();
