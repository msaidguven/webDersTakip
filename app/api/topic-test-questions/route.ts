import { NextRequest, NextResponse } from 'next/server';
import { getTopicTestQuestions } from '@/app/src/lib/quizQuestions';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const questions = await getTopicTestQuestions(topicId);

  return NextResponse.json({ questions });
}
