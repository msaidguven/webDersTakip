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

// Tek satırlık konu ilerlemesi — referans tasarıma göre (bkz. kullanıcının 2026-09-02
// tarihli ekran görüntüsü). KİLİT YOK: her konu her zaman erişilebilir (bkz. kullanıcıyla
// "kilitli üniteler" tartışması) — sadece tamamlanma durumu gösterilir.
export type TopicRowStatus = 'completed' | 'in_progress';

export interface TopicProgress {
  id: string;
  title: string;
  status: TopicRowStatus;
  progressPercent: number;
  actionLabel: 'Konu Anlatımı' | 'Soru Çöz';
  actionHref?: string;
}

export interface Stat {
  id: string;
  icon: string;
  iconColor: 'purple' | 'pink' | 'teal' | 'orange';
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
  questionCount: number;
  durationMinutes: number;
  score: number;
  icon: string;
  iconColor: string;
  isComplete?: boolean;
  resumeHref?: string;
}

export interface DashboardData {
  user: User;
  weeks: Week[];
  currentWeekId: number;
  stats: Stat[];
  srsReview: SRSReview | null;
  units: Unit[];
  recentActivities: Activity[];
  activeUnitId: string | null;
  activeUnitTitle: string | null;
  activeUnitTopics: TopicProgress[];
  lessons: { id: string; name: string }[];
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
