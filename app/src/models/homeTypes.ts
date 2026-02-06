// Home Page Types - Public access

export interface Grade {
  id: string;
  level: number;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Lesson {
  id: string;
  gradeId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  unitCount: number;
  questionCount: number;
  slug?: string | null;
}

export interface Topic {
  id: string;
  unitId: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // minutes
  questionCount: number;
}

export interface Unit {
  id: string;
  lessonId: string;
  name: string;
  description: string;
  order: number;
  topicCount: number;
  topics: Topic[];
}

export interface TestConfig {
  gradeId: string;
  lessonId: string;
  unitId?: string;
  topicIds: string[];
  questionCount: number;
  timeLimit?: number; // minutes, undefined = no limit
}

export type SelectionStep = 'grade' | 'lesson' | 'unit' | 'topic' | 'confirm';

export interface HomeSelectionState {
  step: SelectionStep;
  selectedGrade: Grade | null;
  selectedLesson: Lesson | null;
  selectedUnit: Unit | null;
  selectedTopics: Topic[];
}
