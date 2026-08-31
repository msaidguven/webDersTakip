import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = request.nextUrl.searchParams.get('status') || 'pending';
  const supabase = createServiceClient();

  let query = supabase
    .from('question_comments')
    .select('id, question_id, unit_id, parent_comment_id, body, status, created_at, questions(question_text), units(title)')
    .order('created_at', { ascending: true })
    .limit(200);

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const parentIds = Array.from(
    new Set(rows.map((r) => (r as { parent_comment_id: number | null }).parent_comment_id).filter((id): id is number => id != null))
  );

  let parentBodies: Record<number, string> = {};
  if (parentIds.length) {
    const { data: parents } = await supabase.from('question_comments').select('id, body').in('id', parentIds);
    parentBodies = Object.fromEntries(((parents as { id: number; body: string }[] | null) || []).map((p) => [p.id, p.body]));
  }

  const items = rows.map((r) => ({
    ...r,
    parent_body: (r as { parent_comment_id: number | null }).parent_comment_id
      ? parentBodies[(r as { parent_comment_id: number }).parent_comment_id] || null
      : null,
  }));

  return NextResponse.json({ items });
}
