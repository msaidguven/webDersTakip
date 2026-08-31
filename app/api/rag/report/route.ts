import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğrenci, otomatik yayınlanan bir AI cevabını hatalı/eksik bulursa bildirir.
// Cevap yayından kalkmaz — admin panelindeki "Bildirilenler" listesine düşer,
// admin inceleyip yayından kaldırabilir ya da bildirimi geçersiz sayabilir.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ragAnswerId?: unknown; reason?: unknown } | null;
  const ragAnswerId = Number(body?.ragAnswerId);
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : null;

  if (!Number.isFinite(ragAnswerId)) return NextResponse.json({ error: 'ragAnswerId gerekli' }, { status: 400 });

  const service = createServiceClient();

  const { data: answer } = await service.from('rag_answers').select('id').eq('id', ragAnswerId).maybeSingle();
  if (!answer) return NextResponse.json({ error: 'Cevap bulunamadı' }, { status: 404 });

  const { error: insertError } = await service.from('rag_answer_reports').insert({
    rag_answer_id: ragAnswerId,
    student_id: user.id,
    reason,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
