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
  progress: number;
  status: 'locked' | 'in_progress' | 'completed';
  successRate?: number;
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
}

export interface DashboardData {
  user: User;
  weeks: Week[];
  currentWeekId: number;
  stats: Stat[];
  srsReview: SRSReview | null;
  units: Unit[];
  recentActivities: Activity[];
}

// Navigation
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  isAction?: boolean;
}
