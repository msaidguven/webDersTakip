import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getLessonWeekData } from '@/app/src/lib/lessonWeekData';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));
  const lessonId = Number(searchParams.get('lessonId'));
  const unitId = Number(searchParams.get('unitId'));
  const week = Number(searchParams.get('week'));

  if (![gradeId, lessonId, unitId, week].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();
  const isAdmin = await isViewerAdmin(supabase);
  const { outcomes, contents } = await getLessonWeekData(supabase, unitId, week, isAdmin);

  return NextResponse.json({ outcomes, contents });
}
