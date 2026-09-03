import type { SupabaseClient } from '@supabase/supabase-js';

export type CommentStatus = 'pending' | 'published' | 'rejected';
export type AiMode = 'hocam' | 'kanka';

interface FeedItemBase {
  id: string;
  createdAt: string;
  contextLabel: string | null;
  href: string | undefined;
}

export interface MyCommentItem extends FeedItemBase {
  kind: 'comment';
  body: string;
  status: CommentStatus;
}

export interface MyAiItem extends FeedItemBase {
  kind: 'ai';
  question: string;
  answer: string;
  mode: AiMode;
}

export type MyComment = MyCommentItem | MyAiItem;

type CommentRow = {
  id: number;
  body: string;
  status: string;
  created_at: string;
  question_id: number | null;
  unit_id: number | null;
};

type AiRow = {
  id: number;
  question: string;
  answer: string;
  model: string;
  created_at: string;
  quiz_question_id: number | null;
  unit_id: number | null;
};

export type Ref = { questionId: number | null; unitId: number | null };

// question_comments (yorumlar) ve rag_answers (AI'ye @hocam/@kanka ile sorulan sorular) aynı
// question_id/unit_id şemasını paylaşıyor — hangi ünite/konuya ait olduklarını çözen sorgu
// zinciri (soru -> konu -> ünite -> ders -> sınıf) ikisi için de aynı, bu yüzden ortak bir
// çözücüde birleştiriliyor (dashboardActivities.ts'teki flat-query + in-memory join deseni).
// export: admin/all-comments API route'u da (bkz. app/api/admin/all-comments/route.ts) aynı
// çözümlemeyi ihtiyaç duyuyor, join zincirini ikinci kez yazmak yerine bunu paylaşıyor.
export async function buildContextResolver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  refs: Ref[]
) {
  const questionIds = [...new Set(refs.map((r) => r.questionId).filter((id): id is number => id != null))];
  const { data: questionRows } = questionIds.length
    ? await supabase.from('questions').select('id, topic_id').in('id', questionIds)
    : { data: [] };
  const topicIdByQuestionId = new Map(
    ((questionRows as { id: number; topic_id: number | null }[] | null) || []).map((q) => [q.id, q.topic_id])
  );

  const topicIds = [...new Set([...topicIdByQuestionId.values()].filter((id): id is number => id != null))];
  const { data: topicRows } = topicIds.length
    ? await supabase.from('topics').select('id, title, slug, unit_id').in('id', topicIds)
    : { data: [] };
  const topicById = new Map(
    ((topicRows as { id: number; title: string; slug: string | null; unit_id: number }[] | null) || []).map((t) => [t.id, t])
  );

  const directUnitIds = refs.map((r) => r.unitId).filter((id): id is number => id != null);
  const topicUnitIds = [...topicById.values()].map((t) => t.unit_id);
  const unitIds = [...new Set([...directUnitIds, ...topicUnitIds])];

  const { data: unitRows } = unitIds.length
    ? await supabase.from('units').select('id, title, slug, lesson_id, grade_id').in('id', unitIds)
    : { data: [] };
  const unitById = new Map(
    ((unitRows as { id: number; title: string; slug: string | null; lesson_id: number; grade_id: number }[] | null) || []).map((u) => [u.id, u])
  );

  const lessonIds = [...new Set([...unitById.values()].map((u) => u.lesson_id))];
  const gradeIds = [...new Set([...unitById.values()].map((u) => u.grade_id))];

  const [{ data: lessonRows }, { data: gradeRows }] = await Promise.all([
    lessonIds.length ? supabase.from('lessons').select('id, name, slug').in('id', lessonIds) : Promise.resolve({ data: [] }),
    gradeIds.length ? supabase.from('grades').select('id, slug').in('id', gradeIds) : Promise.resolve({ data: [] }),
  ]);
  const lessonById = new Map(((lessonRows as { id: number; name: string; slug: string | null }[] | null) || []).map((l) => [l.id, l]));
  const gradeSlugById = new Map(((gradeRows as { id: number; slug: string | null }[] | null) || []).map((g) => [g.id, g.slug]));

  return function resolve(ref: Ref): { contextLabel: string | null; href: string | undefined } {
    const topic = ref.questionId != null ? topicById.get(topicIdByQuestionId.get(ref.questionId) ?? -1) : undefined;
    const unitId = ref.unitId ?? topic?.unit_id;
    const unit = unitId != null ? unitById.get(unitId) : undefined;
    const lesson = unit ? lessonById.get(unit.lesson_id) : undefined;
    const gradeSlug = unit ? gradeSlugById.get(unit.grade_id) : undefined;

    const contextLabel = topic
      ? `${lesson?.name ?? 'Ders'} › ${unit?.title ?? 'Ünite'} › ${topic.title}`
      : unit
        ? `${lesson?.name ?? 'Ders'} › ${unit.title}`
        : null;

    // Sadece soru-bazlı kayıtlar için bağlanabilir bir hedef var: soru bankası sayfası
    // (cevap anahtarı), her zaman aynı, sabit soru listesini gösterir ve orada artık
    // (bkz. QuestionBankBoard.tsx) yorum/AI sorusu yapma + kendi yorumunu düzenleme/silme
    // UI'ı da var. kavrama-testi sayfası kasıtlı olarak hedef ALINMIYOR: SRS'e göre
    // kişiselleşmiş bir soru havuzu gösteriyor, yakın zamanda cevaplanmış bir soru bir
    // sonraki ziyarette hiç görünmeyebiliyor. Ünite geneline (question_id'siz) yazılanların
    // bugün gerçek bir düzenle/sil arayüzü yok, bu yüzden onlara link verilmiyor.
    let href: string | undefined;
    if (ref.questionId != null && gradeSlug && lesson?.slug && unit?.slug && topic?.slug) {
      href = `/soru-bankasi/${gradeSlug}/${lesson.slug}/${unit.slug}/${topic.slug}?soru=${ref.questionId}`;
    }

    return { contextLabel, href };
  };
}

// Profildeki "Yorumlarım" kartı için: kullanıcının kendi yorumlarını (question_comments,
// RLS'te own-read her statüde açık) VE AI'ye (@hocam/@kanka) sorduğu soruları (rag_answers)
// tek, kronolojik bir listede birleştirir.
export async function getMyComments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  limit: number = 30
): Promise<MyComment[]> {
  const [{ data: commentRows }, { data: aiRows }] = await Promise.all([
    supabase
      .from('question_comments')
      .select('id, body, status, created_at, question_id, unit_id')
      .eq('student_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(limit),
    // rag_answers'ta status her zaman 'published' olarak kaydediliyor (bkz. /api/rag/ask —
    // AI cevapları moderasyon beklemeden anında yayınlanıyor); RLS de sadece published
    // satırları okutuyor (rag_answers_published_public_read), bu yüzden filtre burada da
    // aynı statüyle uyumlu tutuluyor.
    supabase
      .from('rag_answers')
      .select('id, question, answer, model, created_at, quiz_question_id, unit_id')
      .eq('student_id', userId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const comments = ((commentRows as CommentRow[] | null) || []).filter((c) => c.status !== 'deleted');
  const aiEntries = (aiRows as AiRow[] | null) || [];
  if (comments.length === 0 && aiEntries.length === 0) return [];

  const refs: Ref[] = [
    ...comments.map((c) => ({ questionId: c.question_id, unitId: c.unit_id })),
    ...aiEntries.map((a) => ({ questionId: a.quiz_question_id, unitId: a.unit_id })),
  ];
  const resolve = await buildContextResolver(supabase, refs);

  const commentItems: MyCommentItem[] = comments.map((c) => {
    const { contextLabel, href } = resolve({ questionId: c.question_id, unitId: c.unit_id });
    return {
      kind: 'comment',
      id: `comment-${c.id}`,
      body: c.body,
      status: c.status as CommentStatus,
      createdAt: c.created_at,
      contextLabel,
      href,
    };
  });

  const aiItems: MyAiItem[] = aiEntries.map((a) => {
    const { contextLabel, href } = resolve({ questionId: a.quiz_question_id, unitId: a.unit_id });
    return {
      kind: 'ai',
      id: `ai-${a.id}`,
      question: a.question,
      answer: a.answer,
      mode: a.model.includes('kanka') ? 'kanka' : 'hocam',
      createdAt: a.created_at,
      contextLabel,
      href,
    };
  });

  return [...commentItems, ...aiItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
