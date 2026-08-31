import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğrenci sayfasındaki "Soru Sor" formunun gösterilip gösterilmeyeceğine karar
// vermek için: bu sınıf/ders için en az bir işlenmiş (ready) ders notu var mı?
// rag_documents RLS ile service-role dışına kapalı, bu yüzden herkese açık bu
// route sadece bir boolean döner, doküman içeriğine dokunmaz.
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('rag_documents')
    .select('id', { count: 'exact', head: true })
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .eq('status', 'ready');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ available: (count ?? 0) > 0 });
}
