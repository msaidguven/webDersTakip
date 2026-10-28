// "Yeni yazılı aç" denemeleri — sunucu tarafı ortak kod (bkz. supabase/migrations/yazili_attempts.sql).
// İstemciye giden görünümde cevap anahtarı YOKTUR; model cevap yalnız deneme puanlandıktan sonra eklenir.
import 'server-only';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { renderPlainTextMath } from '@/app/src/lib/topicContentV11';
import type { getYaziliExam } from '@/app/src/lib/yazili/publicData';

export const DAILY_ATTEMPT_LIMIT = 3;
export const YAZILI_IMAGE_BUCKET = 'yazili-answers';
export const YAZILI_IMAGE_RETENTION_DAYS = 90;
const SIGNED_URL_SECONDS = 3600;

export type ExamData = NonNullable<Awaited<ReturnType<typeof getYaziliExam>>>;

export type AttemptItemView = {
  id: number;
  points: number;
  textHtml: string;
  svg: string | null;
  svgPosition: 'above' | 'below';
  answer: string;
  /** Öğrencinin yüklediği kâğıt fotoğrafı (kısa ömürlü imzalı adres); yoksa null. */
  imageUrl: string | null;
  /** Cevap anahtarında çizim var → soru çizim isteyebilir (arayüz fotoğraf/anlatım ipucu gösterir). */
  asksDrawing: boolean;
  // Yalnız puanlandıktan sonra:
  score: number | null;
  feedback: string | null;
  answerHtml: string | null;
};
export type AttemptView = {
  id: number;
  status: 'in_progress' | 'submitted' | 'graded';
  scenario: number | null;
  variant: number | null;
  totalScore: number | null;
  items: AttemptItemView[];
};

// Türkiye UTC+3 (yaz saati yok): günlük hak TR gününe göre sayılır (RPC ile aynı sınır).
function trDayStartIso(): string {
  const TR_OFFSET_MS = 3 * 3600 * 1000;
  const shifted = Date.now() + TR_OFFSET_MS;
  return new Date(shifted - (shifted % 86400000) - TR_OFFSET_MS).toISOString();
}

export async function countAttemptsToday(userId: string): Promise<number> {
  const { count } = await createServiceClient()
    .from('yazili_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', trDayStartIso());
  return count ?? 0;
}

type AttemptRow = {
  id: number; user_id: string; exam_id: number; status: AttemptView['status'];
  scenario_no: number | null; variant: number | null; total_score: number | null;
};
type AnswerRow = {
  question_id: number; position: number; points: number; answer_text: string | null;
  score: number | null; feedback: string | null; answer_image_path: string | null;
};

export async function loadAttemptRow(attemptId: number): Promise<{ attempt: AttemptRow; answers: AnswerRow[] } | null> {
  const supabase = createServiceClient();
  const [{ data: attempt }, { data: answers }] = await Promise.all([
    supabase.from('yazili_attempts').select('id, user_id, exam_id, status, scenario_no, variant, total_score').eq('id', attemptId).maybeSingle(),
    supabase.from('yazili_attempt_answers').select('question_id, position, points, answer_text, score, feedback, answer_image_path').eq('attempt_id', attemptId).order('position'),
  ]);
  return attempt ? { attempt: attempt as AttemptRow, answers: (answers as AnswerRow[] | null) ?? [] } : null;
}

export async function buildAttemptView(attempt: AttemptRow, answers: AnswerRow[], data: ExamData): Promise<AttemptView> {
  const paths = answers.map((a) => a.answer_image_path).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await createServiceClient().storage.from(YAZILI_IMAGE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  const byId = new Map(data.topics.flatMap((t) => t.questions).map((q) => [q.id, q]));
  const graded = attempt.status === 'graded';
  return {
    id: attempt.id,
    status: attempt.status,
    scenario: attempt.scenario_no,
    variant: attempt.variant,
    totalScore: attempt.total_score,
    items: answers.flatMap((a) => {
      const q = byId.get(a.question_id);
      return q
        ? [{
            id: q.id,
            points: a.points,
            textHtml: renderPlainTextMath(q.text),
            svg: q.svgContent,
            svgPosition: q.svgPosition,
            answer: a.answer_text ?? '',
            imageUrl: a.answer_image_path ? signed.get(a.answer_image_path) ?? null : null,
            asksDrawing: !!q.answerSvgContent,
            score: graded ? a.score : null,
            feedback: graded ? a.feedback : null,
            answerHtml: graded ? renderPlainTextMath(q.modelAnswer) : null,
          }]
        : [];
    }),
  };
}

export type AttemptHistoryItem = { id: number; createdAt: string; scenario: number | null; totalScore: number; maxPoints: number };

// Öğrencinin bu yazılıdaki puanlanmış denemeleri (en yeni önce).
export async function loadAttemptHistory(userId: string, examId: number, limit = 20): Promise<AttemptHistoryItem[]> {
  const supabase = createServiceClient();
  const { data: attempts } = await supabase
    .from('yazili_attempts')
    .select('id, created_at, scenario_no, total_score')
    .eq('user_id', userId).eq('exam_id', examId).eq('status', 'graded')
    .order('created_at', { ascending: false }).limit(limit);
  const rows = (attempts as { id: number; created_at: string; scenario_no: number | null; total_score: number | null }[] | null) ?? [];
  if (!rows.length) return [];
  const { data: points } = await supabase.from('yazili_attempt_answers').select('attempt_id, points').in('attempt_id', rows.map((r) => r.id));
  const max = new Map<number, number>();
  for (const p of (points as { attempt_id: number; points: number }[] | null) ?? []) max.set(p.attempt_id, (max.get(p.attempt_id) ?? 0) + p.points);
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, scenario: r.scenario_no, totalScore: r.total_score ?? 0, maxPoints: max.get(r.id) ?? 0 }));
}

// Öğrencinin daha önce cevap yazdığı (boş bırakmadığı) sorular — yeni yazılı önce çözülmemişlerden kurulur.
export async function loadSolvedQuestionIds(userId: string, examId: number): Promise<Set<number>> {
  const supabase = createServiceClient();
  const { data: attempts } = await supabase.from('yazili_attempts').select('id').eq('user_id', userId).eq('exam_id', examId);
  const ids = ((attempts as { id: number }[] | null) ?? []).map((a) => a.id);
  if (!ids.length) return new Set();
  const { data } = await supabase.from('yazili_attempt_answers').select('question_id, answer_text').in('attempt_id', ids);
  return new Set(((data as { question_id: number; answer_text: string | null }[] | null) ?? []).filter((a) => a.answer_text?.trim()).map((a) => a.question_id));
}
