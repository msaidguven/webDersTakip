import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getSectionTestQuestions } from '@/app/src/lib/quizQuestions';

export async function GET(request: NextRequest) {
  const sectionId = request.nextUrl.searchParams.get('sectionId');
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: sectionRow } = await supabase
    .from('topic_content_sections')
    .select('heading')
    .eq('id', sectionId)
    .maybeSingle();
  const heading = (sectionRow as { heading?: string } | null)?.heading || '';

  const questions = await getSectionTestQuestions(sectionId);

  return NextResponse.json({ heading, questions });
}
