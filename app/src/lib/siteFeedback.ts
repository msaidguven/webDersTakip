export const FEEDBACK_ROLES = ['teacher', 'student', 'guest', 'admin'] as const;
export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

export const FEEDBACK_STATUSES = ['new', 'read', 'resolved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_SOURCES = [
  'teacher_home',
  'yazili_builder',
  'student_today',
  'header_menu',
  'contact_page',
] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

export const FEEDBACK_CATEGORIES = [
  'like',
  'idea',
  'curriculum',
  'yazili_tool',
  'content',
  'confusing',
  'bug',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_AREAS = [
  'soru_bankasi',
  'konu_anlatimi',
  'yazili_araci',
  'mufredat_kazanim',
  'tasarim_hiz',
  'diger',
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const ROLE_LABEL: Record<FeedbackRole, string> = {
  teacher: 'Öğretmen',
  student: 'Öğrenci',
  guest: 'Misafir',
  admin: 'Admin',
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Yeni',
  read: 'Okundu',
  resolved: 'Çözüldü',
};

export const SOURCE_LABEL: Record<FeedbackSource, string> = {
  teacher_home: 'Öğretmen Anasayfa',
  yazili_builder: 'Yazılı Hazırlama',
  student_today: 'Öğrenci Anasayfa',
  header_menu: 'Üst Menü',
  contact_page: 'İletişim Sayfası',
};

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  like: 'Beğeni / Teşekkür',
  idea: 'Öneri / Eksik Özellik',
  curriculum: 'Müfredat / Kazanım',
  yazili_tool: 'Yazılı Aracı',
  content: 'Konu Anlatımı & Sorular',
  confusing: 'Zorlandım / Karışık',
  bug: 'Hata Bildirimi',
  other: 'Soru / Diğer',
};

export const AREA_LABEL: Record<FeedbackArea, string> = {
  soru_bankasi: 'Soru Bankası',
  konu_anlatimi: 'Konu Anlatımı',
  yazili_araci: 'Yazılı Çalışması',
  mufredat_kazanim: 'Müfredat / Kazanım',
  tasarim_hiz: 'Tasarım / Hız',
  diger: 'Diğer',
};

export const TEACHER_CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; placeholder: string }[] = [
  {
    value: 'yazili_tool',
    label: 'Yazılı Aracı',
    placeholder: 'Yazılı hazırlarken eksik gördüğünüz bir soru tarzı, şablon detayı veya kolaylık var mı?',
  },
  {
    value: 'curriculum',
    label: 'Müfredat / Kazanım',
    placeholder: 'Haftalık plan, öğrenme çıktısı veya kazanım sıralamasında düzeltmemiz gereken bir yer var mı?',
  },
  {
    value: 'content',
    label: 'Konu Anlatımı & Sorular',
    placeholder: 'Konu özetleri, örnekler veya soru kalitesi hakkında gözünüze çarpanları yazabilirsiniz…',
  },
  {
    value: 'idea',
    label: 'Eksik Özellik',
    placeholder: 'Ders işlerken veya öğrencilerinize ödev/çalışma verirken "keşke şu da olsa" dediğiniz ne var?',
  },
  {
    value: 'bug',
    label: 'Hata Bildirimi',
    placeholder: 'Çalışmayan, takılan veya yanlış görünen yeri kısaca tarif edebilir misiniz?',
  },
  {
    value: 'like',
    label: 'Beğeni / Destek',
    placeholder: 'İşinizi kolaylaştıran veya beğendiğiniz noktaları duymak bize büyük motivasyon verir…',
  },
];

export const STUDENT_REACTIONS: {
  value: FeedbackCategory;
  emoji: string;
  label: string;
  placeholder: string;
}[] = [
  {
    value: 'like',
    emoji: '😍',
    label: 'Çok sevdim',
    placeholder: 'En çok neyi sevdin? İstersen kısaca yazabilirsin (isteğe bağlı)…',
  },
  {
    value: 'idea',
    emoji: '💡',
    label: 'Fikrim var',
    placeholder: 'Sitede ne olsa çalışman daha keyifli ve kolay olurdu? (isteğe bağlı)…',
  },
  {
    value: 'confusing',
    emoji: '🤔',
    label: 'Zorlandım',
    placeholder: 'Nerede zorlandın ya da ne karışık geldi? (isteğe bağlı)…',
  },
  {
    value: 'bug',
    emoji: '🐛',
    label: 'Hata var',
    placeholder: 'Ne yanlış çalıştı veya nerede takıldı? Kısaca yazarsan hemen düzeltelim…',
  },
];

export const STUDENT_AREA_OPTIONS: { value: FeedbackArea; label: string }[] = [
  { value: 'soru_bankasi', label: 'Soru Bankası' },
  { value: 'konu_anlatimi', label: 'Konu Anlatımı' },
  { value: 'yazili_araci', label: 'Yazılı Çalışması' },
  { value: 'tasarim_hiz', label: 'Tasarım / Hız' },
  { value: 'diger', label: 'Diğer' },
];

export const GENERAL_CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: 'idea', label: 'Öneri / Fikir' },
  { value: 'bug', label: 'Hata Bildirimi' },
  { value: 'curriculum', label: 'Müfredat / İçerik' },
  { value: 'like', label: 'Beğeni / Teşekkür' },
  { value: 'other', label: 'Soru / Diğer' },
];

export interface FeedbackContextData {
  lessons?: string[];
  school?: string | null;
  isVerified?: boolean;
  gradeName?: string | null;
  streak?: number;
  viewport?: 'mobile' | 'desktop';
  examId?: number;
  examTitle?: string;
  viewAs?: string | null;
}

export interface SiteFeedbackRow {
  id: number;
  user_id: string | null;
  role: FeedbackRole;
  category: FeedbackCategory;
  area: FeedbackArea | null;
  message: string | null;
  source: FeedbackSource;
  page_path: string | null;
  sender_name: string | null;
  sender_email: string | null;
  context: FeedbackContextData;
  status: FeedbackStatus;
  admin_note: string | null;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
}
