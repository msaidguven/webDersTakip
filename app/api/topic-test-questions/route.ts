import { NextRequest, NextResponse } from 'next/server';
import { getTopicTestQuestions } from '@/app/src/lib/quizQuestions';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const questions = await getTopicTestQuestions(topicId, user?.id ?? null);

  return NextResponse.json({ questions });
}
