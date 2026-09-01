import { NextRequest, NextResponse } from 'next/server';
import { getUnitTestQuestions } from '@/app/src/lib/quizQuestions';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const unitId = request.nextUrl.searchParams.get('unitId');
  if (!unitId) {
    return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { questions, allCaughtUp } = await getUnitTestQuestions(unitId, user?.id ?? null);

  return NextResponse.json({ questions, allCaughtUp });
}
