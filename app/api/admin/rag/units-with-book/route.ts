import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Verilen ünite id'lerinden hangilerine GERÇEK bir ders kitabı (PDF/NotebookLM metni)
// yüklenmiş olduğunu döner — konu sayfasında (/admin/konu-icerik/[topicId]) NotebookLM
// araç grubunu mu yoksa RAG sentez araç grubunu mu göstereceğimize karar vermek için
// (units-with-dedup-check ile aynı desen). source='ai_generated' (RAG taslak/sentez
// metinleri) hariç tutuluyor — onlar da unit_id taşıyor ama gerçek bir kitap DEĞİL.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const raw = request.nextUrl.searchParams.get('unitIds') || '';
  const unitIds = raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (!unitIds.length) return NextResponse.json({ unitIds: [] });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select('unit_id')
    .in('unit_id', unitIds)
    .in('source', ['pdf_upload', 'notebooklm_text']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as { unit_id: number | null }[] | null) || [];
  const found = [...new Set(rows.map((r) => r.unit_id).filter((id): id is number => id != null))];
  return NextResponse.json({ unitIds: found });
}
