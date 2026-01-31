import { DashboardData, NavItem, User, Week, Unit, Stat, SRSReview, Activity } from '../models/types';

export const mockUser: User = {
  id: '1',
  name: 'Ali Yılmaz',
  email: 'ali@example.com',
  avatar: 'https://ui-avatars.com/api/?name=Ali+Y&background=6366f1&color=fff',
  streak: 12,
  dailyGoal: 20,
  dailyProgress: 15,
};

export const mockWeeks: Week[] = [
  { id: 2, number: 2, label: 'Geçen', status: 'past' },
  { id: 3, number: 3, label: 'Şimdi', status: 'current' },
  { id: 4, number: 4, label: 'Gelecek', status: 'future' },
  { id: 5, number: 5, label: 'Gelecek', status: 'future' },
  { id: 6, number: 6, label: 'Kilitli', status: 'locked' },
];

export const mockStats: Stat[] = [
  { id: '1', icon: 'check-circle', iconColor: 'purple', value: 48, label: 'Doğru Cevap' },
  { id: '2', icon: 'clock', iconColor: 'pink', value: 124, label: 'Dakika' },
  { id: '3', icon: 'trophy', iconColor: 'teal', value: '85%', label: 'Başarı Oranı' },
  { id: '4', icon: 'redo', iconColor: 'orange', value: 5, label: 'Tekrar Gerekli' },
];

export const mockSRSReview: SRSReview = {
  id: '1',
  title: 'Zamanı Gelen Tekrarlar',
  description: '5 soru için tekrar zamanı geldi. Bu soruları çözerek öğrenmeni pekiştir.',
  questionCount: 5,
  dueDate: new Date(),
};

export const mockUnits: Unit[] = [
  {
    id: '1',
    title: 'Sayı Sistemi ve İşlemler',
    subtitle: '3. Hafta • 12 Konu • 45 Soru',
    weekNumber: 3,
    totalTopics: 12,
    totalQuestions: 45,
    progress: 65,
    status: 'in_progress',
  },
  {
    id: '2',
    title: 'Geometrik Şekiller',
    subtitle: '2. Hafta • Tamamlandı',
    weekNumber: 2,
    totalTopics: 8,
    totalQuestions: 30,
    progress: 100,
    status: 'completed',
    successRate: 92,
  },
  {
    id: '3',
    title: 'Olasılık',
    subtitle: '4. Hafta • Kilitli',
    weekNumber: 4,
    totalTopics: 10,
    totalQuestions: 35,
    progress: 0,
    status: 'locked',
  },
];

export const mockActivities: Activity[] = [
  {
    id: '1',
    title: 'Haftalık Değerlendirme #3',
    type: 'test',
    timestamp: new Date(),
    questionCount: 15,
    durationMinutes: 12,
    score: 80,
    icon: 'calculator',
    iconColor: 'purple',
  },
  {
    id: '2',
    title: 'Konu Sonu Testi: Üçgenler',
    type: 'topic',
    timestamp: new Date(Date.now() - 86400000),
    questionCount: 10,
    durationMinutes: 8,
    score: 100,
    icon: 'shapes',
    iconColor: 'pink',
  },
  {
    id: '3',
    title: 'Tekrar Seti: 2. Hafta',
    type: 'review',
    timestamp: new Date(Date.now() - 172800000),
    questionCount: 20,
    durationMinutes: 15,
    score: 60,
    icon: 'redo',
    iconColor: 'teal',
  },
];

export const mockDashboardData: DashboardData = {
  user: mockUser,
  weeks: mockWeeks,
  currentWeekId: 3,
  stats: mockStats,
  srsReview: mockSRSReview,
  units: mockUnits,
  recentActivities: mockActivities,
};

export const navItems: NavItem[] = [
  { id: 'home', label: 'Ana Sayfa', icon: 'home', href: '/', isAction: false },
  { id: 'units', label: 'Üniteler', icon: 'book', href: '/units', isAction: false },
  { id: 'start', label: 'Başla', icon: 'play', href: '/start', isAction: true },
  { id: 'stats', label: 'İstatistik', icon: 'chart-line', href: '/stats', isAction: false },
  { id: 'profile', label: 'Profil', icon: 'user', href: '/profile', isAction: false },
];
