import type { SupabaseClient } from '@supabase/supabase-js';

export type CommentStatus = 'pending' | 'published' | 'rejected';

export interface MyComment {
  id: number;
  body: string;
  status: CommentStatus;
  createdAt: string;
  contextLabel: string | null;
  href: string | undefined;
}

type CommentRow = {
  id: number;
  body: string;
  status: string;
  created_at: string;
  question_id: number | null;
  unit_id: number | null;
};

// Profildeki "Yorumlarım" kartı için: kullanıcının kendi question_comments satırlarını
// (RLS'te own-read her statüde açık, bkz. question_comments_own_read) hangi ünite/konuya
// yazıldığını da göstermek üzere çözer. Deep PostgREST embed yerine dashboardActivities.ts
// ile aynı desen izleniyor: id listeleri toplanıp tablo tablo ayrı sorgularla çözülüyor.
export async function getMyComments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  limit: number = 30
): Promise<MyComment[]> {
  const { data: commentRows } = await supabase
    .from('question_comments')
    .select('id, body, status, created_at, question_id, unit_id')
    .eq('student_id', userId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(limit);

  const comments = (commentRows as CommentRow[] | null) || [];
  if (comments.length === 0) return [];

  const questionIds = [...new Set(comments.map((c) => c.question_id).filter((id): id is number => id != null))];

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

  const directUnitIds = comments.map((c) => c.unit_id).filter((id): id is number => id != null);
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

  return comments
    .filter((c): c is CommentRow & { status: CommentStatus } => c.status !== 'deleted')
    .map((c) => {
      const topic = c.question_id != null ? topicById.get(topicIdByQuestionId.get(c.question_id) ?? -1) : undefined;
      const unitId = c.unit_id ?? topic?.unit_id;
      const unit = unitId != null ? unitById.get(unitId) : undefined;
      const lesson = unit ? lessonById.get(unit.lesson_id) : undefined;
      const gradeSlug = unit ? gradeSlugById.get(unit.grade_id) : undefined;

      const contextLabel = topic
        ? `${lesson?.name ?? 'Ders'} › ${unit?.title ?? 'Ünite'} › ${topic.title}`
        : unit
          ? `${lesson?.name ?? 'Ders'} › ${unit.title}`
          : null;

      // Sadece soru-bazlı yorumlar için bağlanabilir bir hedef var: soru bankası sayfası
      // (cevap anahtarı), her zaman aynı, sabit soru listesini gösterir ve orada artık
      // (bkz. QuestionBankBoard.tsx) yorum yapma + kendi yorumunu düzenleme/silme UI'ı da
      // var. kavrama-testi sayfası kasıtlı olarak hedef ALINMIYOR: SRS'e göre kişiselleşmiş
      // bir soru havuzu gösteriyor, yakın zamanda doğru cevaplanmış bir soru bir sonraki
      // ziyarette hiç görünmeyebiliyor — yani yorumun yapıldığı soruya güvenilir şekilde
      // geri dönmeyi garanti etmiyor. Ünite geneline (question_id'siz) yazılan yorumların
      // bugün gerçek bir düzenle/sil arayüzü yok (ders içerik sayfası unit-wide yorumu
      // gösterse de hangi konudan açılacağı belirsiz), bu yüzden onlara link verilmiyor —
      // sadece bağlam etiketi gösteriliyor.
      let href: string | undefined;
      if (c.question_id != null && gradeSlug && lesson?.slug && unit?.slug && topic?.slug) {
        href = `/soru-bankasi/${gradeSlug}/${lesson.slug}/${unit.slug}/${topic.slug}?soru=${c.question_id}`;
      }

      return {
        id: c.id,
        body: c.body,
        status: c.status,
        createdAt: c.created_at,
        contextLabel,
        href,
      };
    });
}
