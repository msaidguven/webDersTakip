import { Grade, Lesson, Unit, Topic } from '../models/homeTypes';

export const grades: Grade[] = [
  { id: '6', level: 6, name: '6. Sınıf', description: 'Ortaokul 1. seviye', icon: '📚', color: 'from-emerald-500 to-teal-500' },
  { id: '7', level: 7, name: '7. Sınıf', description: 'Ortaokul 2. seviye', icon: '📖', color: 'from-cyan-500 to-blue-500' },
  { id: '8', level: 8, name: '8. Sınıf', description: 'Ortaokul 3. seviye - LGS', icon: '🎯', color: 'from-blue-500 to-indigo-500' },
  { id: '9', level: 9, name: '9. Sınıf', description: 'Lise 1. sınıf', icon: '🎓', color: 'from-indigo-500 to-purple-500' },
  { id: '10', level: 10, name: '10. Sınıf', description: 'Lise 2. sınıf', icon: '🔬', color: 'from-purple-500 to-pink-500' },
  { id: '11', level: 11, name: '11. Sınıf', description: 'Lise 3. sınıf - YKS hazırlık', icon: '⚡', color: 'from-pink-500 to-rose-500' },
  { id: '12', level: 12, name: '12. Sınıf', description: 'Lise 4. sınıf - YKS', icon: '🚀', color: 'from-orange-500 to-amber-500' },
];

export const lessons: Record<string, Lesson[]> = {
  '6': [
    { id: '6-mat', gradeId: '6', name: 'Matematik', description: 'Temel matematik kavramları', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 8, questionCount: 240 },
    { id: '6-fen', gradeId: '6', name: 'Fen Bilimleri', description: 'Doğa ve bilim', icon: '🔬', color: 'from-emerald-500 to-teal-500', unitCount: 6, questionCount: 180 },
    { id: '6-turkce', gradeId: '6', name: 'Türkçe', description: 'Dil ve anlatım', icon: '📝', color: 'from-orange-500 to-amber-500', unitCount: 5, questionCount: 150 },
    { id: '6-ing', gradeId: '6', name: 'İngilizce', description: 'Yabancı dil', icon: '🌍', color: 'from-blue-500 to-cyan-500', unitCount: 4, questionCount: 120 },
  ],
  '7': [
    { id: '7-mat', gradeId: '7', name: 'Matematik', description: 'Cebir ve geometri', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 9, questionCount: 270 },
    { id: '7-fen', gradeId: '7', name: 'Fen Bilimleri', description: 'Bilimsel düşünme', icon: '🔬', color: 'from-emerald-500 to-teal-500', unitCount: 7, questionCount: 210 },
    { id: '7-turkce', gradeId: '7', name: 'Türkçe', description: 'Edebiyat ve dil', icon: '📝', color: 'from-orange-500 to-amber-500', unitCount: 6, questionCount: 180 },
    { id: '7-sos', gradeId: '7', name: 'Sosyal Bilgiler', description: 'Toplum ve kültür', icon: '🏛️', color: 'from-amber-500 to-yellow-500', unitCount: 5, questionCount: 150 },
  ],
  '8': [
    { id: '8-mat', gradeId: '8', name: 'Matematik', description: 'LGS matematik', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 10, questionCount: 300 },
    { id: '8-fen', gradeId: '8', name: 'Fen Bilimleri', description: 'LGS fen', icon: '🔬', color: 'from-emerald-500 to-teal-500', unitCount: 8, questionCount: 240 },
    { id: '8-turkce', gradeId: '8', name: 'Türkçe', description: 'LGS Türkçe', icon: '📝', color: 'from-orange-500 to-amber-500', unitCount: 7, questionCount: 210 },
    { id: '8-ink', gradeId: '8', name: 'İnkılap Tarihi', description: 'Atatürk ilkeleri', icon: '⭐', color: 'from-red-500 to-rose-500', unitCount: 4, questionCount: 120 },
    { id: '8-din', gradeId: '8', name: 'Din Kültürü', description: 'Din ve ahlak', icon: '🕌', color: 'from-teal-500 to-emerald-500', unitCount: 3, questionCount: 90 },
  ],
  '9': [
    { id: '9-mat', gradeId: '9', name: 'Matematik', description: 'Lise matematiği', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 8, questionCount: 240 },
    { id: '9-fiz', gradeId: '9', name: 'Fizik', description: 'Fizik bilimi', icon: '⚛️', color: 'from-blue-500 to-indigo-500', unitCount: 6, questionCount: 180 },
    { id: '9-kim', gradeId: '9', name: 'Kimya', description: 'Kimya bilimi', icon: '⚗️', color: 'from-emerald-500 to-green-500', unitCount: 5, questionCount: 150 },
    { id: '9-biyo', gradeId: '9', name: 'Biyoloji', description: 'Yaşam bilimi', icon: '🧬', color: 'from-green-500 to-emerald-500', unitCount: 5, questionCount: 150 },
  ],
  '10': [
    { id: '10-mat', gradeId: '10', name: 'Matematik', description: 'İleri matematik', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 9, questionCount: 270 },
    { id: '10-fiz', gradeId: '10', name: 'Fizik', description: 'Mekanik ve termodinamik', icon: '⚛️', color: 'from-blue-500 to-indigo-500', unitCount: 7, questionCount: 210 },
    { id: '10-kim', gradeId: '10', name: 'Kimya', description: 'Organik kimya', icon: '⚗️', color: 'from-emerald-500 to-green-500', unitCount: 6, questionCount: 180 },
    { id: '10-biyo', gradeId: '10', name: 'Biyoloji', description: 'Hücre ve metabolizma', icon: '🧬', color: 'from-green-500 to-emerald-500', unitCount: 6, questionCount: 180 },
  ],
  '11': [
    { id: '11-mat', gradeId: '11', name: 'Matematik', description: 'TYT/AYT matematik', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 10, questionCount: 300 },
    { id: '11-geometri', gradeId: '11', name: 'Geometri', description: 'TYT/AYT geometri', icon: '📐', color: 'from-purple-500 to-pink-500', unitCount: 8, questionCount: 240 },
    { id: '11-fiz', gradeId: '11', name: 'Fizik', description: 'AYT fizik', icon: '⚛️', color: 'from-blue-500 to-indigo-500', unitCount: 8, questionCount: 240 },
    { id: '11-kim', gradeId: '11', name: 'Kimya', description: 'AYT kimya', icon: '⚗️', color: 'from-emerald-500 to-green-500', unitCount: 7, questionCount: 210 },
    { id: '11-biyo', gradeId: '11', name: 'Biyoloji', description: 'AYT biyoloji', icon: '🧬', color: 'from-green-500 to-emerald-500', unitCount: 7, questionCount: 210 },
  ],
  '12': [
    { id: '12-mat', gradeId: '12', name: 'Matematik', description: 'YKS matematik', icon: '🔢', color: 'from-indigo-500 to-purple-500', unitCount: 12, questionCount: 360 },
    { id: '12-geometri', gradeId: '12', name: 'Geometri', description: 'YKS geometri', icon: '📐', color: 'from-purple-500 to-pink-500', unitCount: 10, questionCount: 300 },
    { id: '12-fiz', gradeId: '12', name: 'Fizik', description: 'YKS fizik', icon: '⚛️', color: 'from-blue-500 to-indigo-500', unitCount: 10, questionCount: 300 },
    { id: '12-kim', gradeId: '12', name: 'Kimya', description: 'YKS kimya', icon: '⚗️', color: 'from-emerald-500 to-green-500', unitCount: 9, questionCount: 270 },
    { id: '12-biyo', gradeId: '12', name: 'Biyoloji', description: 'YKS biyoloji', icon: '🧬', color: 'from-green-500 to-emerald-500', unitCount: 9, questionCount: 270 },
  ],
};

// Mock Units and Topics for Mathematics Grade 8
export const mockUnits: Unit[] = [
  {
    id: 'unit-1',
    lessonId: '8-mat',
    name: '1. Ünite: Sayılar ve İşlemler',
    description: 'Tam sayılar, rasyonel sayılar ve işlemler',
    order: 1,
    topicCount: 4,
    topics: [
      { id: 'topic-1-1', unitId: 'unit-1', name: 'Tam Sayılar', description: 'Negatif ve pozitif tam sayılar', difficulty: 'easy', estimatedTime: 15, questionCount: 10 },
      { id: 'topic-1-2', unitId: 'unit-1', name: 'Rasyonel Sayılar', description: 'Kesirli sayılar ve işlemler', difficulty: 'medium', estimatedTime: 20, questionCount: 12 },
      { id: 'topic-1-3', unitId: 'unit-1', name: 'Tam Sayılarda İşlemler', description: 'Toplama, çıkarma, çarpma, bölme', difficulty: 'medium', estimatedTime: 25, questionCount: 15 },
      { id: 'topic-1-4', unitId: 'unit-1', name: 'Rasyonel Sayılarda İşlemler', description: 'Kesirlerde dört işlem', difficulty: 'hard', estimatedTime: 30, questionCount: 15 },
    ],
  },
  {
    id: 'unit-2',
    lessonId: '8-mat',
    name: '2. Ünite: Üslü Sayılar',
    description: 'Üslü sayılar ve işlemler',
    order: 2,
    topicCount: 3,
    topics: [
      { id: 'topic-2-1', unitId: 'unit-2', name: 'Üslü Sayıların Tanımı', description: 'Üslü ifadeler', difficulty: 'easy', estimatedTime: 15, questionCount: 10 },
      { id: 'topic-2-2', unitId: 'unit-2', name: 'Üslü Sayılarda Çarpma ve Bölme', description: 'Üslü işlemler', difficulty: 'medium', estimatedTime: 25, questionCount: 15 },
      { id: 'topic-2-3', unitId: 'unit-2', name: 'Bilimsel Gösterim', description: 'Çok büyük ve çok küçük sayılar', difficulty: 'medium', estimatedTime: 20, questionCount: 12 },
    ],
  },
  {
    id: 'unit-3',
    lessonId: '8-mat',
    name: '3. Ünite: Kareköklü Sayılar',
    description: 'Kareköklü ifadeler',
    order: 3,
    topicCount: 3,
    topics: [
      { id: 'topic-3-1', unitId: 'unit-3', name: 'Kareköklü Sayıların Tanımı', description: 'Karekök kavramı', difficulty: 'easy', estimatedTime: 15, questionCount: 10 },
      { id: 'topic-3-2', unitId: 'unit-3', name: 'Kareköklü Sayıların Sadeleştirilmesi', description: 'Sadeleştirme işlemleri', difficulty: 'medium', estimatedTime: 25, questionCount: 15 },
      { id: 'topic-3-3', unitId: 'unit-3', name: 'Kareköklü Sayılarda İşlemler', description: 'Dört işlem', difficulty: 'hard', estimatedTime: 30, questionCount: 15 },
    ],
  },
  {
    id: 'unit-4',
    lessonId: '8-mat',
    name: '4. Ünite: Olasılık',
    description: 'Olasılık hesaplamaları',
    order: 4,
    topicCount: 2,
    topics: [
      { id: 'topic-4-1', unitId: 'unit-4', name: 'Olasılığa Giriş', description: 'Temel kavramlar', difficulty: 'easy', estimatedTime: 20, questionCount: 12 },
      { id: 'topic-4-2', unitId: 'unit-4', name: 'Olasılık Hesaplama', description: 'Basit olayların olasılığı', difficulty: 'medium', estimatedTime: 25, questionCount: 15 },
    ],
  },
];

export function getLessonsByGrade(gradeId: string): Lesson[] {
  return lessons[gradeId] || [];
}

export function getUnitsByLesson(lessonId: string): Unit[] {
  // For now, return mock units for 8-mat
  if (lessonId === '8-mat') return mockUnits;
  return [];
}
