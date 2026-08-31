import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir ünitede sorulan ve yayınlanmış TÜM soru-cevaplar — herkese açık, tıpkı o
// üniteye yapılmış yorumlar gibi (kim sormuşsa görünür, sadece soran değil).
// Kişisel/özel sohbet ayrı bir özellik olarak düşünüldüğü için bu akış bilerek
// herkese açık; giriş yapmamış ziyaretçi de görebilir, sadece soru soramaz.
export async function GET(request: NextRequest) {
  const unitId = Number(request.nextUrl.searchParams.get('unitId'));
  if (!Number.isFinite(unitId)) return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_answers')
    // rag_answers'ın profiles'a iki FK'sı var (student_id, reviewed_by) — hangisini
    // kullanacağını PostgREST'e açıkça söylemek gerekiyor, yoksa "ambiguous embed" hatası verir.
    .select('id, question, answer, created_at, profiles!rag_answers_student_id_fkey(username, full_name, avatar_url)')
    .eq('unit_id', unitId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}
