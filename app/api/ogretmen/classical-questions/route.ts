import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const MAX_TOPICS = 50;

// Öğretmen paneli: seçilen (birden fazla olabilir) konudaki yayındaki klasik/açık uçlu
// soruları listeler. is_active=false (SVG bekleyen taslak) sorular BİLEREK dışlanıyor —
// öğretmenin önüne hiç yayınlanmamış/yarım içerik gelmemeli.
export async function GET(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher.ok) return teacher.response;

  const topicIdsParam = request.nextUrl.searchParams.get('topicIds');
  const topicIds = (topicIdsParam || '')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);

  if (!topicIds.length || topicIds.length > MAX_TOPICS) {
    return NextResponse.json({ error: `1-${MAX_TOPICS} arası konu seçilmeli` }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topicRows } = await supabase.from('topics').select('id, title').in('id', topicIds);
  const topicTitleById = new Map(((topicRows as { id: number; title: string }[] | null) || []).map((t) => [t.id, t.title]));

  const { data: questionRows, error } = await supabase
    .from('questions')
    .select('id, question_text, svg_content, svg_position, topic_id')
    .in('topic_id', topicIds)
    .eq('question_type_id', 4) // classical — bkz. question_types tablosu
    .eq('is_active', true)
    .order('topic_id', { ascending: true })
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = (questionRows as { id: number; question_text: string; svg_content: string | null; svg_position: 'above' | 'below'; topic_id: number }[] | null) || [];
  if (!questions.length) return NextResponse.json({ questions: [] });

  const ids = questions.map((q) => q.id);
  const { data: classicalRows } = await supabase
    .from('question_classical')
    .select('question_id, model_answer, key_terms')
    .in('question_id', ids);

  const classicalByQuestion = new Map(
    ((classicalRows as { question_id: number; model_answer: string | null; key_terms: string[] }[] | null) || []).map((r) => [r.question_id, r])
  );

  const items = questions.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    svgContent: q.svg_content,
    svgPosition: q.svg_position,
    topicId: q.topic_id,
    topicTitle: topicTitleById.get(q.topic_id) || '',
    modelAnswer: classicalByQuestion.get(q.id)?.model_answer || null,
    keyTerms: classicalByQuestion.get(q.id)?.key_terms || [],
  }));

  return NextResponse.json({ questions: items });
}
