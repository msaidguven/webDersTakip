import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const RESULT_LIMIT = 25;

type QuestionRow = {
  id: number;
  question_text: string;
  solution_text: string | null;
  topic_id: number | null;
  topics: { title: string } | { title: string }[] | null;
  question_types: { code: string } | { code: string }[] | null;
};

type ContentRow = {
  id: number;
  title: string;
  subtitle: string | null;
  body_markdown: string | null;
  is_published: boolean;
  topic_id: number | null;
  topics: { title: string } | { title: string }[] | null;
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const q = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (q.length < 2) {
    return NextResponse.json({ error: 'Arama için en az 2 karakter girin' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const pattern = `%${q}%`;

  const [qByText, qBySolution, cByTitle, cBySubtitle, cByBody] = await Promise.all([
    supabase
      .from('questions')
      .select('id, question_text, solution_text, topic_id, topics(title), question_types(code)')
      .ilike('question_text', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('questions')
      .select('id, question_text, solution_text, topic_id, topics(title), question_types(code)')
      .ilike('solution_text', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title)')
      .ilike('title', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title)')
      .ilike('subtitle', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
    supabase
      .from('topic_contents')
      .select('id, title, subtitle, body_markdown, is_published, topic_id, topics(title)')
      .ilike('body_markdown', pattern)
      .order('created_at', { ascending: false })
      .limit(RESULT_LIMIT),
  ]);

  const firstError = [qByText, qBySolution, cByTitle, cBySubtitle, cByBody].find((r) => r.error)?.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const questionsById = new Map<number, QuestionRow>();
  for (const row of [...(qByText.data || []), ...(qBySolution.data || [])] as QuestionRow[]) {
    questionsById.set(row.id, row);
  }

  const contentsById = new Map<number, ContentRow>();
  for (const row of [...(cByTitle.data || []), ...(cBySubtitle.data || []), ...(cByBody.data || [])] as ContentRow[]) {
    contentsById.set(row.id, row);
  }

  return NextResponse.json({
    questions: Array.from(questionsById.values()).slice(0, RESULT_LIMIT),
    contents: Array.from(contentsById.values()).slice(0, RESULT_LIMIT),
  });
}
