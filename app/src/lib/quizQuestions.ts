import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { createAnonClient } from '@/utils/supabase/server-anon';

export type Option = { id: number; text: string; is_correct: boolean };
export type Pair = { id: number; left_text: string; right_text: string };

export type SvgPosition = 'above' | 'below';
export type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; svg_content: string | null; svg_position: SvgPosition; choices: Option[] };
export type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; svg_content: string | null; svg_position: SvgPosition; options: Option[] };
export type MatchingQuestion = { id: number; type: 'matching'; pairs: Pair[] };
export type ClassicalQuestion = { id: number; type: 'classical'; question_text: string; svg_content: string | null; svg_position: SvgPosition; modelAnswer: string | null };
export type QuizQuestion = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion | ClassicalQuestion;

// Test sayfasındaki "AI'ye Sor" widget'ı, öğrenci "neden A" gibi kısa bir şey yazınca
// hangi sorudan bahsettiğini bilsin diye aktif sorunun düz metin özetini üretir —
// doğru cevap da dahil, çünkü amaç Gemini'nin "neden X doğru" diye açıklayabilmesi.
export function formatQuestionContext(q: QuizQuestion): string {
  const letter = (i: number) => String.fromCharCode(65 + i);
  switch (q.type) {
    case 'multiple_choice':
      return `Öğrencinin şu anda baktığı çoktan seçmeli soru: ${q.question_text}\nŞıklar:\n${q.choices
        .map((c, i) => `${letter(i)}) ${c.text}${c.is_correct ? ' — doğru cevap bu' : ''}`)
        .join('\n')}`;
    case 'blank':
      return `Öğrencinin şu anda baktığı boşluk doldurma sorusu: ${q.question_text}\nSeçenekler:\n${q.options
        .map((o, i) => `${letter(i)}) ${o.text}${o.is_correct ? ' — doğru cevap bu' : ''}`)
        .join('\n')}`;
    case 'matching':
      return `Öğrencinin şu anda baktığı eşleştirme sorusu, doğru çiftler:\n${q.pairs
        .map((p) => `${p.left_text} — ${p.right_text}`)
        .join('\n')}`;
    case 'classical':
      return `Öğrencinin şu anda baktığı açık uçlu soru: ${q.question_text}${
        q.modelAnswer ? `\nÖrnek/model cevap: ${q.modelAnswer}` : ''
      }`;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bir soru kimliği listesi için tip bazlı detayları (şık/boşluk seçeneği/eşleştirme
// çifti/klasik model cevap) toplu çekip normalize edilmiş, karışık sıralı soru
// listesine dönüştürür. Soru tipi question_type_id'ye göre değil, hangi alt tabloda
// veri bulunduğuna göre belirlenir — bu, question_type_id numaralandırmasından
// bağımsız ve KarisikTestClient'ın eski (çalışan) davranışıyla tutarlıdır.
async function resolveQuestions(questionIds: number[], opts: { preserveOrder?: boolean } = {}): Promise<QuizQuestion[]> {
  if (!questionIds.length) return [];

  // Bu fonksiyon SADECE soru İÇERİĞİNİ (metin/şık/eşleştirme/model cevap) çözer, hiçbir
  // kullanıcıya özel veriye dokunmaz (kişiselleştirme selectPersonalizedQuestionIds'te,
  // ayrı ve hâlâ service-role client kullanıyor) — bu yüzden cookie'siz anon client
  // güvenle kullanılabiliyor. /soru-bankasi sayfasının (getAllTopicQuestions üzerinden)
  // ISR ile cache'lenebilmesi için gerekliydi (service-role client'ın no-store fetch
  // override'ı sayfayı dinamik render etmeye zorluyordu, bkz. [konu]/page.tsx'teki not).
  const supabase = createAnonClient();

  const [{ data: questionsData }, { data: choicesData }, { data: optionsData }, { data: pairsData }, { data: classicalData }] = await Promise.all([
    supabase.from('questions').select('id, question_text, solution_text, svg_content, svg_position').in('id', questionIds),
    supabase.from('question_choices').select('id, question_id, choice_text, is_correct').in('question_id', questionIds),
    supabase.from('question_blank_options').select('id, question_id, option_text, is_correct').in('question_id', questionIds),
    supabase.from('question_matching_pairs').select('id, question_id, left_text, right_text').in('question_id', questionIds),
    supabase.from('question_classical').select('question_id, model_answer').in('question_id', questionIds),
  ]);

  const choicesByQuestion = new Map<number, Option[]>();
  ((choicesData as { id: number; question_id: number; choice_text: string; is_correct: boolean }[] | null) || []).forEach((c) => {
    const list = choicesByQuestion.get(c.question_id) || [];
    list.push({ id: c.id, text: c.choice_text, is_correct: c.is_correct });
    choicesByQuestion.set(c.question_id, list);
  });

  const optionsByQuestion = new Map<number, Option[]>();
  ((optionsData as { id: number; question_id: number; option_text: string; is_correct: boolean }[] | null) || []).forEach((o) => {
    const list = optionsByQuestion.get(o.question_id) || [];
    list.push({ id: o.id, text: o.option_text, is_correct: o.is_correct });
    optionsByQuestion.set(o.question_id, list);
  });

  const pairsByQuestion = new Map<number, Pair[]>();
  ((pairsData as { id: number; question_id: number; left_text: string; right_text: string }[] | null) || []).forEach((p) => {
    const list = pairsByQuestion.get(p.question_id) || [];
    list.push({ id: p.id, left_text: p.left_text, right_text: p.right_text });
    pairsByQuestion.set(p.question_id, list);
  });

  const classicalByQuestion = new Map<number, string | null>();
  ((classicalData as { question_id: number; model_answer: string | null }[] | null) || []).forEach((c) => {
    classicalByQuestion.set(c.question_id, c.model_answer);
  });

  const all: QuizQuestion[] = [];

  ((questionsData as { id: number; question_text: string; solution_text: string | null; svg_content: string | null; svg_position: SvgPosition }[] | null) || []).forEach((q) => {
    const choices = shuffle(choicesByQuestion.get(q.id) || []);
    if (choices.length >= 2) {
      all.push({ id: q.id, type: 'multiple_choice', question_text: q.question_text, solution_text: q.solution_text, svg_content: q.svg_content, svg_position: q.svg_position, choices });
      return;
    }
    const options = shuffle(optionsByQuestion.get(q.id) || []);
    if (options.length >= 2 && q.question_text.includes('_____')) {
      all.push({ id: q.id, type: 'blank', question_text: q.question_text, solution_text: q.solution_text, svg_content: q.svg_content, svg_position: q.svg_position, options });
      return;
    }
    const pairs = shuffle(pairsByQuestion.get(q.id) || []);
    if (pairs.length >= 2) {
      all.push({ id: q.id, type: 'matching', pairs });
      return;
    }
    if (classicalByQuestion.has(q.id)) {
      all.push({ id: q.id, type: 'classical', question_text: q.question_text, svg_content: q.svg_content, svg_position: q.svg_position, modelAnswer: classicalByQuestion.get(q.id) ?? null });
    }
  });

  if (opts.preserveOrder) {
    const orderIndex = new Map(questionIds.map((id, i) => [id, i]));
    return all.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));
  }

  return shuffle(all);
}

// Bir testte gösterilecek soru sayısı sabitlendi: hem tekrar çözmeyi (havuz büyükse
// her seferinde farklı 10 soru) hem soru sayısına göre süre hesaplamayı basitleştiriyor.
export const MAX_QUESTIONS_PER_TEST = 10;
export const SECONDS_PER_QUESTION = 60;

export interface PersonalizedQuestionSet {
  questions: QuizQuestion[];
  // true = havuzdaki hiçbir soru şu an "çözülmeye uygun" değil (hepsi ya zaten ustalaşılmış
  // ya da SRS tekrar zamanı henüz gelmemiş) — bu, "içerik yok" değil "şimdilik bitirdin"
  // demek; QuizClient bu durumda "Tebrikler" ekranı gösterir.
  allCaughtUp: boolean;
}

// Giriş yapmış kullanıcı için soru seçim önceliği (kullanıcı kararı, 2026-09-02):
//   1. Hiç çözülmemiş sorular (user_question_stats'ta hiç kaydı olmayanlar)
//   2. Daha önce çözülmüş ama SRS'e göre tekrar zamanı GELMİŞ sorular (next_review_at <= şimdi),
//      en acil (en eski next_review_at) önce — bkz. mobil app'in aynı SRS motoru.
// Tekrar zamanı henüz gelmemiş (yakın zamanda ustalaşılmış) sorular ASLA gösterilmez — mobil
// uygulamanın aksine burada bir "geri kalan her şey" havuzuna düşülmüyor; havuz boşsa
// allCaughtUp=true döner ve çağıran taraf "şu an çözülecek yeni/vakti gelmiş soru yok" der.
async function selectPersonalizedQuestionIds(
  supabase: ReturnType<typeof createServiceClient>,
  questionIds: number[],
  userId: string | null | undefined,
  limit: number
): Promise<{ questionIds: number[]; allCaughtUp: boolean }> {
  if (!userId || questionIds.length === 0) {
    return { questionIds: shuffle(questionIds).slice(0, limit), allCaughtUp: false };
  }

  const { data: statsRows } = await supabase
    .from('user_question_stats')
    .select('question_id, total_attempts, next_review_at')
    .eq('user_id', userId)
    .in('question_id', questionIds);

  const statsByQuestion = new Map(
    ((statsRows as { question_id: number; total_attempts: number; next_review_at: string | null }[] | null) || []).map((r) => [
      r.question_id,
      r,
    ])
  );

  const now = Date.now();
  const unseen: number[] = [];
  const due: { id: number; nextReviewAt: number }[] = [];

  for (const id of questionIds) {
    const stat = statsByQuestion.get(id);
    if (!stat || !stat.total_attempts) {
      unseen.push(id);
      continue;
    }
    if (stat.next_review_at && new Date(stat.next_review_at).getTime() <= now) {
      due.push({ id, nextReviewAt: new Date(stat.next_review_at).getTime() });
    }
    // next_review_at gelecekte ise (henüz vakti gelmemiş): bilerek atlanıyor, fallback yok.
  }

  due.sort((a, b) => a.nextReviewAt - b.nextReviewAt);

  const ordered = [...shuffle(unseen), ...due.map((d) => d.id)];
  return { questionIds: ordered.slice(0, limit), allCaughtUp: ordered.length === 0 };
}

async function getTopicQuestionPoolIds(supabase: ReturnType<typeof createServiceClient>, topicId: number | string): Promise<number[]> {
  const { data: questionIdRows } = await supabase.from('questions').select('id').eq('topic_id', topicId);
  return ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
}

// Bir konunun (topic) tüm alt başlıklarına ve konu geneline ait sorular (konu kavrama
// testi) — questions.topic_id üzerinden, section_id'si dolu ya da boş fark etmeksizin.
export async function getTopicTestQuestions(topicId: number | string, userId?: string | null): Promise<PersonalizedQuestionSet> {
  const supabase = createServiceClient();
  const questionIds = await getTopicQuestionPoolIds(supabase, topicId);
  const { questionIds: selected, allCaughtUp } = await selectPersonalizedQuestionIds(supabase, questionIds, userId, MAX_QUESTIONS_PER_TEST);
  return { questions: await resolveQuestions(selected), allCaughtUp };
}

export interface PersonalizedQuestionPlan {
  firstQuestion: QuizQuestion | null;
  remainingQuestionIds: number[];
  allCaughtUp: boolean;
}

// getTopicTestQuestions ile AYNI kişiselleştirilmiş seçimi yapar ama içerik olarak sadece ilk
// soruyu çözer — sayfa sadece bu ilk soruyu SSR'da bekler, kalan id'ler client'a verilip arka
// planda (bkz. getQuestionsByIdsInTopicPool) yüklenir. Sayfa hızlı açılsın diye (artık SEO amaçlı
// tüm soruların SSR'da hazır olmasına gerek yok, bkz. /soru-bankasi).
export async function planTopicTestQuestions(topicId: number | string, userId?: string | null): Promise<PersonalizedQuestionPlan> {
  const supabase = createServiceClient();
  const questionIds = await getTopicQuestionPoolIds(supabase, topicId);
  const { questionIds: selected, allCaughtUp } = await selectPersonalizedQuestionIds(supabase, questionIds, userId, MAX_QUESTIONS_PER_TEST);
  if (!selected.length) return { firstQuestion: null, remainingQuestionIds: [], allCaughtUp };
  const [firstQuestion] = await resolveQuestions([selected[0]]);
  return { firstQuestion: firstQuestion ?? null, remainingQuestionIds: selected.slice(1), allCaughtUp };
}

// Client'tan gelen (SSR sırasında seçilmiş) kalan soru id'lerini çözer — ama önce o konunun
// GERÇEK soru havuzuyla kesiştirir, böylece keyfi id verilerek başka/taslak sorulara erişilemez
// (getQuestionsByIds tek başına sahiplik kontrolü yapmıyor).
export async function getQuestionsByIdsInTopicPool(topicId: number | string, ids: number[]): Promise<QuizQuestion[]> {
  const supabase = createServiceClient();
  const pool = new Set(await getTopicQuestionPoolIds(supabase, topicId));
  const safeIds = ids.filter((id) => pool.has(id));
  return getQuestionsByIds(safeIds);
}

// Bir konunun TÜM sorularını (kişiselleştirme/limit OLMADAN, id sırasıyla) getirir —
// /soru-bankasi sayfası için: kavrama testinin aksine burada havuzdan bir alt küme değil,
// konudaki her soru tek bir statik sayfada listeleniyor.
// Soru bankası sayfasındaki "Yorumlar" butonunda tıklamadan önce sayı gösterebilmek için —
// tek, bulk sorguyla (soru başına ayrı sorgu değil) yayınlanmış yorum + AI sorusu sayısını
// çeker. Kişiselleştirme yok (sadece status='published', anon client) — ISR cache'i bozmaz,
// bkz. getAllTopicQuestions'taki aynı gerekçe. Görüntüleyenin kendi 'pending' yorumu bu
// sayıma girmez (sunucu render'ında kim baktığı bilinmiyor) — kabul edilebilir bir eksiklik,
// UnitDiscussion içindeki asıl liste açılınca zaten tam/güncel halini gösteriyor.
export async function getQuestionCommentCounts(questionIds: number[]): Promise<Record<number, number>> {
  if (!questionIds.length) return {};
  const supabase = createAnonClient();
  const [{ data: commentRows }, { data: aiRows }] = await Promise.all([
    supabase.from('question_comments').select('question_id').eq('status', 'published').in('question_id', questionIds),
    supabase.from('rag_answers').select('quiz_question_id').eq('status', 'published').in('quiz_question_id', questionIds),
  ]);

  const counts: Record<number, number> = {};
  for (const row of (commentRows as { question_id: number | null }[] | null) || []) {
    if (row.question_id != null) counts[row.question_id] = (counts[row.question_id] || 0) + 1;
  }
  for (const row of (aiRows as { quiz_question_id: number | null }[] | null) || []) {
    if (row.quiz_question_id != null) counts[row.quiz_question_id] = (counts[row.quiz_question_id] || 0) + 1;
  }
  return counts;
}

export async function getAllTopicQuestions(topicId: number | string): Promise<QuizQuestion[]> {
  // Kişiselleştirme yok (sadece topic_id filtresi), bu yüzden resolveQuestions gibi anon
  // client kullanıyor — /soru-bankasi sayfasının ISR ile cache'lenebilmesi için (bkz. o
  // fonksiyondaki not).
  const supabase = createAnonClient();
  const { data: questionIdRows } = await supabase.from('questions').select('id').eq('topic_id', topicId).order('id', { ascending: true });
  const questionIds = ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
  return getQuestionsByIds(questionIds);
}

// Belirli soru id'lerini, verilen sırayı KORUYARAK çözer — yarım kalmış bir test
// oturumunu aynı soru havuzuyla ve aynı sırayla devam ettirmek için kullanılır (bkz.
// quizResume.ts), rastgele yeni bir set seçmek yerine. Sıra korunmazsa, zaten cevaplanmış
// sorular her resume'da farklı bir pozisyonda görünür (bkz. session_ids sırası).
export async function getQuestionsByIds(questionIds: number[]): Promise<QuizQuestion[]> {
  return resolveQuestions(questionIds, { preserveOrder: true });
}

async function getUnitQuestionPoolIds(supabase: ReturnType<typeof createServiceClient>, unitId: number | string): Promise<number[]> {
  const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', unitId).eq('is_active', true);
  const topicIds = ((topicRows as { id: number }[] | null) || []).map((t) => t.id);
  if (!topicIds.length) return [];

  const { data: questionIdRows } = await supabase.from('questions').select('id').in('topic_id', topicIds);
  return ((questionIdRows as { id: number }[] | null) || []).map((r) => r.id);
}

// Bir ünitenin tüm konularına ait sorular (ünite testi) — questions.topic_id üzerinden,
// section_id'si dolu ya da boş fark etmeksizin.
export async function getUnitTestQuestions(unitId: number | string, userId?: string | null): Promise<PersonalizedQuestionSet> {
  const supabase = createServiceClient();
  const questionIds = await getUnitQuestionPoolIds(supabase, unitId);
  const { questionIds: selected, allCaughtUp } = await selectPersonalizedQuestionIds(supabase, questionIds, userId, MAX_QUESTIONS_PER_TEST);
  return { questions: await resolveQuestions(selected), allCaughtUp };
}

// planTopicTestQuestions ile aynı mantık, ünite testi için — bkz. o fonksiyonun yorumu.
export async function planUnitTestQuestions(unitId: number | string, userId?: string | null): Promise<PersonalizedQuestionPlan> {
  const supabase = createServiceClient();
  const questionIds = await getUnitQuestionPoolIds(supabase, unitId);
  const { questionIds: selected, allCaughtUp } = await selectPersonalizedQuestionIds(supabase, questionIds, userId, MAX_QUESTIONS_PER_TEST);
  if (!selected.length) return { firstQuestion: null, remainingQuestionIds: [], allCaughtUp };
  const [firstQuestion] = await resolveQuestions([selected[0]]);
  return { firstQuestion: firstQuestion ?? null, remainingQuestionIds: selected.slice(1), allCaughtUp };
}

// getQuestionsByIdsInTopicPool ile aynı güvenlik mantığı, ünite havuzu için.
export async function getQuestionsByIdsInUnitPool(unitId: number | string, ids: number[]): Promise<QuizQuestion[]> {
  const supabase = createServiceClient();
  const pool = new Set(await getUnitQuestionPoolIds(supabase, unitId));
  const safeIds = ids.filter((id) => pool.has(id));
  return getQuestionsByIds(safeIds);
}
