// Domain Models

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  streak: number;
  dailyGoal: number;
  dailyProgress: number;
}

export interface Week {
  id: number;
  number: number;
  label: string;
  status: 'past' | 'current' | 'future' | 'locked';
}

// Panel anasayfasındaki ders kartları için — ünite kartlarıyla aynı görsel dilde
// (soru sayısı + progress bar), bkz. LessonExplorer.
export interface LessonProgress {
  id: string;
  name: string;
  icon: string;
  totalQuestions: number;
  solvedQuestions: number;
  progress: number;
}

export interface Unit {
  id: string;
  title: string;
  subtitle: string;
  weekNumber: number;
  totalTopics: number;
  totalQuestions: number;
  solvedQuestions: number;
  progress: number;
  status: 'in_progress' | 'completed';
  successRate?: number;
  href?: string;
}

// Ünite akordeonundaki tek konu satırı — içerik (Konu Anlatımı) ve sorular (Soru Çöz)
// birbirinden BAĞIMSIZ iki durum/buton olarak modellenir (eskiden tek "actionLabel"a
// indirgeniyordu). href yoksa (içerik/soru hiç yoksa) ilgili buton pasif gösterilir.
// KİLİT YOK: her konu her zaman erişilebilir, sadece tamamlanma durumu gösterilir.
export interface UnitTopic {
  id: string;
  title: string;
  contentHref?: string;
  contentCompleted: boolean;
  quizHref?: string;
  quizProgress: number;
  quizCompleted: boolean;
  totalQuestions: number;
  solvedQuestions: number;
}

export interface Stat {
  id: string;
  icon: string;
  iconColor: 'indigo' | 'purple' | 'pink' | 'teal' | 'orange' | 'rose';
  value: string | number;
  label: string;
}

export interface SRSReview {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  dueDate: Date;
}

export interface Activity {
  id: string;
  title: string;
  type: 'test' | 'topic' | 'review';
  timestamp: Date;
  // Tamamlanmış denemede: toplam soru sayısı. Yarım kalanda: şu ana kadar ÇÖZÜLEN soru
  // sayısı — toplam havuz ayrıca totalQuestionCount'ta tutulur (ilerleme çubuğu için).
  questionCount: number;
  totalQuestionCount?: number;
  durationMinutes: number;
  score: number;
  icon: string;
  iconColor: string;
  isComplete?: boolean;
  resumeHref?: string;
}

export interface DashboardData {
  user: User;
  weeklyActiveDays: boolean[];
  stats: Stat[];
  overallStats: { totalQuestions: number; correctAnswers: number; wrongAnswers: number; accuracy: number } | null;
  srsReview: SRSReview | null;
  units: Unit[];
  recentActivities: Activity[];
  activeUnitId: string | null;
  topicsByUnitId: Record<string, UnitTopic[]>;
  lessons: LessonProgress[];
  selectedLessonId: string | null;
}

// Navigation
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  isAction?: boolean;
}
