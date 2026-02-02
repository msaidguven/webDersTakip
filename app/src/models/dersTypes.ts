// Ders (Lesson) Page Types
export interface Outcome {
  id: number;
  description: string;
  topicTitle: string;
}

export interface TopicContent {
  id: number;
  title: string;
  content: string;
  orderNo: number;
}

export interface LessonData {
  gradeName: string;
  lessonName: string;
  outcomes: Outcome[];
  contents: TopicContent[];
}

export interface DersState {
  data: LessonData | null;
  isLoading: boolean;
  error: string | null;
  activeTab: 'outcomes' | 'content';
}

export interface DersViewModel {
  // State
  state: DersState;
  
  // Actions
  setActiveTab: (tab: 'outcomes' | 'content') => void;
  refreshData: () => Promise<void>;
}
