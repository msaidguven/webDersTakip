import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Etkileşimli ders önizlemesinde tek şık kontrolü. Doğru şık istemciye yalnızca cevap verildikten sonra döner.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { questionId?: unknown; choiceId?: unknown } | null;
  const questionId = Number(body?.questionId);
  const choiceId = Number(body?.choiceId);
  if (!Number.isInteger(questionId) || !Number.isInteger(choiceId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('question_choices').select('id, is_correct').eq('question_id', questionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { id: number; is_correct: boolean }[];
  const picked = rows.find((r) => r.id === choiceId);
  if (!picked) return NextResponse.json({ error: 'Geçersiz şık' }, { status: 400 });

  return NextResponse.json({
    correct: picked.is_correct,
    correctChoiceId: rows.find((r) => r.is_correct)?.id ?? null,
  });
}
