// Elle yazılmış etkileşimli dersler (Aşama 1). 817 ve 881 tek bölümlük keşif haritası örnekleri. Diğer konuların dersleri worker'ın ürettiği interactive_lessons tablosundan (hydrate.ts).
import type { LessonDefinition } from './types';
import { lesson704 } from './lessons/704';
import { lesson817 } from './lessons/817';
import { lesson818 } from './lessons/818';
import { lesson881 } from './lessons/881';

const LESSONS: Record<number, LessonDefinition> = { 704: lesson704, 817: lesson817, 818: lesson818, 881: lesson881 };

// Worker bu konulara ders üretmez (elle yazılmış ders önceliklidir).
export const HAND_WRITTEN_TOPIC_IDS = Object.keys(LESSONS).map(Number);

export function getLessonDefinition(topicId: number): LessonDefinition | null {
  return LESSONS[topicId] ?? null;
}
