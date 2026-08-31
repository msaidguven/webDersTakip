import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğrencinin bu sınıf+ders için daha önce sorduğu ve yayınlanmış soru-cevapları
// döner — sayfaya her dönüşte geçmiş sorular kaybolmasın diye.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ items: [] });

  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('rag_answers')
    .select('id, question, answer, created_at')
    .eq('student_id', user.id)
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
