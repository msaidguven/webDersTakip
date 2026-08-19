import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type QuestionRow = { topic_id: number; section_id: number | null };

// Admin sidebar'ında konu/alt başlık menülerinde "zaten soru eklenmiş mi" tikini
// göstermek için: verilen konular için genel konu sorusu var mı ve hangi alt
// başlıklarda soru var, tek sorguda döner.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicIdsParam = request.nextUrl.searchParams.get('topicIds');
  if (!topicIdsParam) {
    return NextResponse.json({ error: 'topicIds gerekli' }, { status: 400 });
  }

  const topicIds = topicIdsParam
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

  if (!topicIds.length) {
    return NextResponse.json({ byTopic: {} });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('questions')
    .select('topic_id, section_id')
    .in('topic_id', topicIds);

  const rows = (data as QuestionRow[] | null) || [];

  const byTopic: Record<string, { general: boolean; sectionIds: number[] }> = {};
  for (const topicId of topicIds) {
    byTopic[topicId] = { general: false, sectionIds: [] };
  }

  for (const row of rows) {
    const entry = byTopic[row.topic_id];
    if (!entry) continue;
    if (row.section_id == null) {
      entry.general = true;
    } else if (!entry.sectionIds.includes(row.section_id)) {
      entry.sectionIds.push(row.section_id);
    }
  }

  return NextResponse.json({ byTopic });
}
