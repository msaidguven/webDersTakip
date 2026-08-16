import { NextRequest, NextResponse } from 'next/server';
import { getUnitTestQuestions } from '@/app/src/lib/quizQuestions';

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get('unitId');
  if (!unitId) {
    return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });
  }

  const questions = await getUnitTestQuestions(unitId);

  return NextResponse.json({ questions });
}
