// Konu ustalığı (İlerlemem 4e konu haritası + 4f zorlandığın konular, 2026-09-28).
// Ham sayılar get_my_topic_mastery RPC'sinden (Soru Bankası ile aynı havuz/son-cevap tanımı);
// durum kuralı SADECE burada.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSoruBankasiLessonPath, buildSoruBankasiUnitPath } from './soruBankasiPaths';

// Kullanıcıyla kararlaştırıldı:
//  - "öğrenildi" (2026-09-28) = konunun sorularının en az %70'i çözülmüş VE doğruluk en az %80.
//  - "zorlanıyorsun" (2026-09-29) = en az 10 soru çözülmüş VE doğruluk %60'ın altında. 10'dan
//    az soruda değerlendirme yapılmaz ("veri az") — tek-iki yanlışla damga vurulmasın.
// AYNI eşikler anasayfadaki "en çok zorlandığın konu" SQL'inde de var
// (supabase/migrations/weak_topic_by_accuracy.sql) — değiştirirsen ikisini birlikte değiştir.
export const MASTERY_RULES = {
  learnedCoverage: 0.7,
  learnedAccuracy: 0.8,
  weakAccuracy: 0.6,
  minSolvedToJudge: 10,
} as const;

export type MasteryState = 'new' | 'weak' | 'building' | 'learned';

export const MASTERY_LABEL: Record<MasteryState, string> = {
  new: 'Başlanmadı',
  weak: 'Zorlanıyorsun',
  building: 'Pekişiyor',
  learned: 'Öğrenildi',
};

export interface TopicMastery {
  id: number;
  title: string;
  href: string | null;
  total: number;
  solved: number;
  correct: number;
  wrong: number;
  accuracy: number | null; // 0-100, son cevaplara göre
  state: MasteryState;
}

export interface LessonMastery {
  id: number;
  name: string;
  href: string | null;
  topics: TopicMastery[];
  counts: Record<MasteryState, number>;
}

export interface MasteryResult {
  gradeId: number;
  lessons: LessonMastery[];
}

type Row = {
  lesson_id: number;
  lesson_name: string;
  lesson_slug: string | null;
  grade_slug: string | null;
  unit_slug: string | null;
  topic_id: number;
  topic_title: string;
  topic_slug: string | null;
  total_questions: number;
  solved_questions: number;
  correct_answers: number;
};

export function masteryState(total: number, solved: number, correct: number): MasteryState {
  if (solved === 0) return 'new';
  const accuracy = correct / solved;
  if (total > 0 && solved / total >= MASTERY_RULES.learnedCoverage && accuracy >= MASTERY_RULES.learnedAccuracy) return 'learned';
  if (solved >= MASTERY_RULES.minSolvedToJudge && accuracy < MASTERY_RULES.weakAccuracy) return 'weak';
  return 'building';
}

export function groupMastery(rows: Row[]): LessonMastery[] {
  const lessons = new Map<number, LessonMastery>();
  for (const r of rows) {
    let lesson = lessons.get(r.lesson_id);
    if (!lesson) {
      lesson = {
        id: r.lesson_id,
        name: r.lesson_name,
        href: r.grade_slug && r.lesson_slug ? buildSoruBankasiLessonPath(r.grade_slug, r.lesson_slug) : null,
        topics: [],
        counts: { new: 0, weak: 0, building: 0, learned: 0 },
      };
      lessons.set(r.lesson_id, lesson);
    }
    const state = masteryState(r.total_questions, r.solved_questions, r.correct_answers);
    lesson.counts[state]++;
    lesson.topics.push({
      id: r.topic_id,
      title: r.topic_title,
      href:
        r.grade_slug && r.lesson_slug && r.unit_slug && r.topic_slug
          ? `${buildSoruBankasiUnitPath(r.grade_slug, r.lesson_slug, r.unit_slug)}/${r.topic_slug}`
          : null,
      total: r.total_questions,
      solved: r.solved_questions,
      correct: r.correct_answers,
      wrong: r.solved_questions - r.correct_answers,
      accuracy: r.solved_questions ? Math.round((r.correct_answers / r.solved_questions) * 100) : null,
      state,
    });
  }
  return [...lessons.values()];
}

export interface WeakTopic extends TopicMastery {
  lessonName: string;
}

// "En çok zorlandığın konular" (4f, kural 2026-09-29): yalnızca "zorlanıyorsun" durumundaki
// konular (≥10 çözülmüş, doğruluk <%60); en düşük doğruluk önce, eşitlikte yanlışı çok olan.
// Salt yanlış sayısı KULLANILMAZ: çok soru çözülmüş ama %67 giden konu listeye giriyordu.
export function weakestTopics(lessons: LessonMastery[], limit = 5): WeakTopic[] {
  return lessons
    .flatMap((l) => l.topics.filter((t) => t.state === 'weak').map((t) => ({ ...t, lessonName: l.name })))
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.wrong - a.wrong)
    .slice(0, limit);
}

// Listenin altındaki bilgi satırları: değerlendirmeye yetecek kadar soru çözülmemiş (1–9) ve
// hiç başlanmamış konu sayıları. "Öğrenildi" olanlar veri az sayılmaz (kapsam şartı zaten var).
export function masteryCoverage(lessons: LessonMastery[]): { tooFewSolved: number; notStarted: number } {
  const topics = lessons.flatMap((l) => l.topics);
  return {
    tooFewSolved: topics.filter((t) => t.state === 'building' && t.solved < MASTERY_RULES.minSolvedToJudge).length,
    notStarted: topics.filter((t) => t.state === 'new').length,
  };
}

// Profildeki sınıf; yoksa (nadir) en son çözülen testin sınıfı — getDashboardLessons ile aynı.
async function resolveGradeId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number | null> {
  const { data: profile } = await supabase.from('profiles').select('grade_id').eq('id', userId).maybeSingle();
  const gradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;
  if (gradeId) return gradeId;
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('grade_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (sessions?.[0] as { grade_id: number | null } | undefined)?.grade_id ?? null;
}

export async function fetchTopicMastery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<MasteryResult | null> {
  const gradeId = await resolveGradeId(supabase, userId);
  if (!gradeId) return null;
  const { data, error } = await supabase.rpc('get_my_topic_mastery', { p_grade_id: gradeId });
  if (error) throw error;
  return { gradeId, lessons: groupMastery((data as Row[] | null) ?? []) };
}
