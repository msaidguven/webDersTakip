import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = request.nextUrl.searchParams.get('status') || 'open';
  const supabase = createServiceClient();

  let query = supabase
    .from('rag_answer_reports')
    .select('id, rag_answer_id, reason, status, created_at, rag_answers(id, question, question_context, answer, model, status, grade_id, lesson_id, grades(name), lessons(name))')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
