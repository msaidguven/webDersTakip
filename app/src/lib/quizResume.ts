import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuestionsByIds, type QuizQuestion } from './quizQuestions';

export interface ResumableSession {
  sessionId: number;
  questions: QuizQuestion[];
  answers: { questionId: number; isCorrect: boolean }[];
}

// Kullanıcı bir ünite/konu testini yarım bırakıp sayfayı tekrar açtığında (yenileme, geri
// gelme vb.) sıfırdan yeni bir test_sessions satırı ve yeni rastgele soru seti açmak yerine
// son bitmemiş oturumu bulur ve aynı soru havuzuyla, zaten cevaplananları atlayarak devam
// ettirir. Öncesinde her sayfa yüklemesi ayrı bir oturum açıyordu ve hiçbiri bitmiyordu — bu da
// hem istatistiklerin (SRS, ünite özeti) hiç hesaplanmamasına hem de panelde "hiç aktivite yok"
// görünmesine yol açıyordu.
export async function findResumableSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  unitId: number,
  topicId: number | null
): Promise<ResumableSession | null> {
  let query = supabase
    .from('test_sessions')
    .select('id, question_ids')
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  query = topicId != null ? query.eq('settings->>topic_id', String(topicId)) : query.is('settings->>topic_id', null);

  const { data: sessionRow } = await query.maybeSingle();
  const session = sessionRow as { id: number; question_ids: number[] | null } | null;
  if (!session || !session.question_ids?.length) return null;

  const [{ data: answerRows }, questions] = await Promise.all([
    supabase.from('test_session_answers').select('question_id, is_correct').eq('test_session_id', session.id),
    getQuestionsByIds([...new Set(session.question_ids)]),
  ]);

  if (questions.length === 0) return null;

  const answers = ((answerRows as { question_id: number; is_correct: boolean }[] | null) || []).map((a) => ({
    questionId: a.question_id,
    isCorrect: a.is_correct,
  }));

  return { sessionId: session.id, questions, answers };
}

export interface ConflictingSession {
  sessionId: number;
  scopeLabel: string;
  href: string;
  total: number;
  answeredCount: number;
}

// Aynı ünitenin konu testi ile ünite testi AYNI soru havuzunu paylaşıyor (ünite testi tüm
// konuların sorularından oluşuyor) — ikisi aynı anda açık kalırsa biri diğerinin sorularını
// "arkadan" çözüp öbürünü hayalete çevirebiliyor (bkz. kullanıcının 2026-09-06 bug raporu ve
// tartışması). Yeni bir test başlatılmadan (yani findResumableSession BU scope için null
// dönüp sıfırdan bir oturum açılacakken) önce, aynı ünitede DİĞER scope'tan açık bir oturum
// var mı diye bakılır — varsa kullanıcıya "devam mı, yeni mi" seçimi sunuluyor, sessizce
// üstüne yazılmıyor.
export async function findConflictingSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  unitId: number,
  // Başlatılmak istenen YENİ testin scope'u — 'topic' iken çakışma adayı ünite testi
  // (topic_id null), 'unit' iken çakışma adayı o ünitedeki HERHANGİ bir konu testidir.
  scope: 'topic' | 'unit',
  paths: { gradeSlug: string | null; lessonSlug: string | null; unitSlug: string | null }
): Promise<ConflictingSession | null> {
  let query = supabase
    .from('test_sessions')
    .select('id, question_ids, settings')
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  query = scope === 'topic' ? query.is('settings->>topic_id', null) : query.not('settings->>topic_id', 'is', null);

  const { data: sessionRow } = await query.maybeSingle();
  const session = sessionRow as { id: number; question_ids: number[] | null; settings: { topic_id: number | null } | null } | null;
  if (!session || !session.question_ids?.length) return null;

  const { data: answerRows } = await supabase.from('test_session_answers').select('question_id').eq('test_session_id', session.id);
  const answeredCount = new Set(((answerRows as { question_id: number }[] | null) || []).map((a) => a.question_id)).size;

  const basePath = `/soru-bankasi/${paths.gradeSlug}/${paths.lessonSlug}/${paths.unitSlug}`;

  if (scope === 'topic') {
    // Çakışan oturum bir ÜNİTE testi.
    return { sessionId: session.id, scopeLabel: 'Ünite Testi', href: basePath, total: session.question_ids.length, answeredCount };
  }

  // Çakışan oturum bir KONU testi — hangi konu olduğunu (başlık/slug) ayrıca çözmemiz gerekiyor.
  const conflictTopicId = session.settings?.topic_id ?? null;
  const { data: topicRow } = conflictTopicId
    ? await supabase.from('topics').select('title, slug').eq('id', conflictTopicId).maybeSingle()
    : { data: null };
  const topic = topicRow as { title: string; slug: string | null } | null;

  return {
    sessionId: session.id,
    scopeLabel: topic ? `${topic.title} Kavrama Testi` : 'Konu Testi',
    href: topic?.slug ? `${basePath}/${topic.slug}` : basePath,
    total: session.question_ids.length,
    answeredCount,
  };
}
