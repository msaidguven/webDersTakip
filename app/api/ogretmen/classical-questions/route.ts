import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğretmen paneli: seçilen konudaki yayındaki klasik/açık uçlu soruları listeler.
// is_active=false (SVG bekleyen taslak) sorular BİLEREK dışlanıyor — öğretmenin
// önüne hiç yayınlanmamış/yarım içerik gelmemeli.
export async function GET(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher.ok) return teacher.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: questionRows, error } = await supabase
    .from('questions')
    .select('id, question_text, svg_content, svg_position')
    .eq('topic_id', topicId)
    .eq('question_type_id', 4) // classical — bkz. question_types tablosu
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = (questionRows as { id: number; question_text: string; svg_content: string | null; svg_position: 'above' | 'below' }[] | null) || [];
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
    modelAnswer: classicalByQuestion.get(q.id)?.model_answer || null,
    keyTerms: classicalByQuestion.get(q.id)?.key_terms || [],
  }));

  return NextResponse.json({ questions: items });
}
