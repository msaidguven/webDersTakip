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

// Panel ders kartı — üniteler panelde gösterilmiyor, detay Soru Bankası'nda (bkz.
// dashboardLessons.ts). Doğru/yanlış her sorunun SON cevabına göre.
export interface LessonProgress {
  id: string;
  name: string;
  icon: string;
  totalQuestions: number;
  solvedQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  progress: number;
  soruBankasiHref?: string;
  // Dersin konu anlatımı sayfası (/<sınıf>/<ders>) — girişli anasayfada konulara giden yol.
  lessonHref?: string;
  weakTopic: { title: string; wrongCount: number; href: string } | null;
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
  recentActivities: Activity[];
  lessons: LessonProgress[];
}

// Navigation
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  isAction?: boolean;
}
