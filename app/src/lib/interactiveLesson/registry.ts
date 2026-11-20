// Elle yazılmış etkileşimli dersler (v1: 704, 817, 818, 881; v2 altın örnek: 861). Diğer konuların dersleri worker'ın ürettiği interactive_lessons tablosundan (hydrate.ts).
import type { LessonDefinition } from './types';
import type { LessonDefinitionV2 } from './typesV2';
import { HAND_WRITTEN_LESSON_TOPIC_IDS } from './handWritten';
import { lesson704 } from './lessons/704';
import { lesson817 } from './lessons/817';
import { lesson818 } from './lessons/818';
import { lesson861 } from './lessons/861';
import { lesson881 } from './lessons/881';

export type AnyLessonDefinition = LessonDefinition | LessonDefinitionV2;

const LESSONS: Record<number, AnyLessonDefinition> = {
  704: lesson704,
  817: lesson817,
  818: lesson818,
  861: lesson861,
  881: lesson881,
};

// Worker bu konulara ders üretmez (elle yazılmış ders önceliklidir).
export const HAND_WRITTEN_TOPIC_IDS = Object.keys(LESSONS).map(Number);
// Hafif listeyle (handWritten.ts, konu sayfası kullanır) ayrışmasın.
if (HAND_WRITTEN_TOPIC_IDS.length !== HAND_WRITTEN_LESSON_TOPIC_IDS.length || HAND_WRITTEN_TOPIC_IDS.some((id) => !HAND_WRITTEN_LESSON_TOPIC_IDS.includes(id))) {
  throw new Error('interactiveLesson/handWritten.ts listesi registry.ts dersleriyle aynı olmalı');
}

export function getLessonDefinition(topicId: number): AnyLessonDefinition | null {
  return LESSONS[topicId] ?? null;
}
