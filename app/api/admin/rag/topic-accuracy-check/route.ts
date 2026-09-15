import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type Finding = { sectionId: number; note: string };

// "Doğruluk Kontrolü"nün (27. prompt) admin tarafından ayrıştırılmış sonucunu kaydeder —
// AI içeriği doğrudan üzerine yazmıyor (dedup'ın aksine burada yanlış bir "düzeltme"
// AI'ın kendisi hatalıysa içeriği daha da bozabilir), sadece bulguyu rag_topic_review_flags'e
// yazıp topics.rag_last_checked_at'i günceller; admin her bulguyu var olan "İçeriği Düzenle"
// akışından kendisi uygular (bkz. DersClient.tsx openContentEditModal).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; findings?: unknown } | null;
  const topicId = Number(body?.topicId);
  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });

  const rawFindings = Array.isArray(body?.findings) ? (body!.findings as unknown[]) : [];
  const findings: Finding[] = rawFindings
    .map((f) => {
      const obj = f as { sectionId?: unknown; note?: unknown };
      const sectionId = Number(obj?.sectionId);
      const note = typeof obj?.note === 'string' ? obj.note.trim() : '';
      return Number.isFinite(sectionId) && note ? { sectionId, note } : null;
    })
    .filter((f): f is Finding => f !== null);

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  if (findings.length) {
    const { error: insertError } = await supabase.from('rag_topic_review_flags').insert(
      findings.map((f) => ({
        topic_id: topicId,
        section_id: f.sectionId,
        kind: 'accuracy_check',
        note: f.note,
        created_by: admin.user.id,
      }))
    );
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from('topics').update({ rag_last_checked_at: new Date().toISOString() }).eq('id', topicId);

  return NextResponse.json({ inserted: findings.length });
}
