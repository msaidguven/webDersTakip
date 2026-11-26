import 'server-only';
import { generateGeminiJson } from '@/app/src/lib/geminiJsonGen';
import type { GeminiWorkerProfile } from '@/app/src/lib/geminiWorkerProfile';
import type { LessonSource } from './generate';
import { buildLessonV3Prompt, parseGeneratedLessonV3 } from './generateV3Core';
import type { LessonDefinitionV3 } from './typesV3';

export { buildLessonV3Prompt, parseGeneratedLessonV3 } from './generateV3Core';

// v3 Etkileşimli Ders AI Üreticisi (Atom Keşif Dünyası — Tek-Bilgi Anlatım + Mikro-Laboratuvar + Çok Turlu Kavram Avı + Havuz Soruları).
// Herhangi bir ders/konu için Supabase'teki yayındaki kitap bölümlerini (topic_content_sections),
// anahtar kavramları (topic_content_highlights) ve aktif havuz sorularını (questions) kullanarak
// %100 kitaba sadık, deterministik olarak doğrulanmış LessonDefinitionV3 JSON'u üretir.

export async function produceLessonV3(
  src: LessonSource,
  profile: GeminiWorkerProfile,
): Promise<{ lesson: LessonDefinitionV3; errors: string[]; model: string; calls: number }> {
  let errorsText: string | undefined;
  for (let calls = 1; calls <= 2; calls++) {
    const out = await generateGeminiJson(buildLessonV3Prompt(src, errorsText), profile);
    const { lesson, errors } = parseGeneratedLessonV3(out.data, src);
    if (!errors.length || calls >= 2) {
      return { lesson, errors, model: out.model, calls };
    }
    errorsText = errors.slice(0, 20).join('\n');
  }
  throw new Error('v3 ders üretimi beklenmedik şekilde sonlandı');
}
