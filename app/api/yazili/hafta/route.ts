import { NextRequest, NextResponse } from 'next/server';
import { activeExamWeek, examWeekRange } from '@/app/src/lib/yazili/common';
import { getGradeExamsFor } from '@/app/src/lib/yazili/publicData';

// Yazılı haftası penceresi (MemberPromptModal): yazılı haftası aralığındaysak (bir hafta öncesinden hafta sonuna)
// öğrencinin sınıfında yayındaki o dönem-yazılı listesi. Herkese açık veri; CDN'de 1 saat önbellekli.
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  if (!Number.isInteger(gradeId) || gradeId <= 0) return NextResponse.json({ error: 'gradeId zorunlu' }, { status: 400 });
  const week = activeExamWeek();
  const exams = week ? await getGradeExamsFor(gradeId, week.term, week.examNo) : [];
  return NextResponse.json(
    { week: week && exams.length ? { ...week, range: examWeekRange(week) } : null, exams },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
  );
}
