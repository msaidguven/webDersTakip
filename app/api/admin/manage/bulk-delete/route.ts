import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  deleteQuestionsCascade,
  deleteTopicContentsCascade,
  deleteTopicsCascade,
  deleteOutcomesCascade,
  deleteUnitsCascade,
} from '@/app/src/lib/adminCascade';

type Scope = 'unit-questions' | 'unit-topics' | 'unit-contents' | 'grade-lesson-units' | 'grade-lesson-outcomes';

type ResolveResult = { table: 'questions' | 'topic_contents' | 'topics' | 'units' | 'outcomes'; ids: number[] };

// questions tablosunda topic_id yok — bağlantı question_usages (question_id + topic_id)
// üzerinden kuruluyor, aynı soru birden fazla topic_id'de kullanılmış olabilir (distinct).
async function questionIdsForTopics(supabase: ReturnType<typeof createServiceClient>, topicIds: number[]): Promise<number[]> {
  if (!topicIds.length) return [];
  const { data } = await supabase.from('question_usages').select('question_id').in('topic_id', topicIds);
  const ids = ((data as { question_id: number }[] | null) || []).map((r) => r.question_id);
  return Array.from(new Set(ids));
}

async function resolveIds(
  supabase: ReturnType<typeof createServiceClient>,
  scope: Scope,
  gradeId: number | null,
  lessonId: number | null,
  unitId: number | null
): Promise<ResolveResult | { error: string }> {
  if (scope === 'unit-questions' || scope === 'unit-topics' || scope === 'unit-contents') {
    if (!unitId) return { error: 'unitId zorunlu' };
    const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', unitId);
    const topicIds = ((topicRows as { id: number }[] | null) || []).map((r) => r.id);

    if (scope === 'unit-topics') return { table: 'topics', ids: topicIds };
    if (!topicIds.length) return { table: scope === 'unit-questions' ? 'questions' : 'topic_contents', ids: [] };

    if (scope === 'unit-questions') {
      return { table: 'questions', ids: await questionIdsForTopics(supabase, topicIds) };
    }
    const { data: cRows } = await supabase.from('topic_contents').select('id').in('topic_id', topicIds);
    return { table: 'topic_contents', ids: ((cRows as { id: number }[] | null) || []).map((r) => r.id) };
  }

  if (!gradeId || !lessonId) return { error: 'gradeId ve lessonId zorunlu' };
  const { data: unitRows } = await supabase.from('units').select('id').eq('grade_id', gradeId).eq('lesson_id', lessonId);
  const unitIds = ((unitRows as { id: number }[] | null) || []).map((r) => r.id);

  if (scope === 'grade-lesson-units') return { table: 'units', ids: unitIds };

  if (!unitIds.length) return { table: 'outcomes', ids: [] };
  const { data: topicRows } = await supabase.from('topics').select('id').in('unit_id', unitIds);
  const topicIds = ((topicRows as { id: number }[] | null) || []).map((r) => r.id);
  if (!topicIds.length) return { table: 'outcomes', ids: [] };
  const { data: outcomeRows } = await supabase.from('outcomes').select('id').in('topic_id', topicIds);
  return { table: 'outcomes', ids: ((outcomeRows as { id: number }[] | null) || []).map((r) => r.id) };
}

const VALID_SCOPES: Scope[] = ['unit-questions', 'unit-topics', 'unit-contents', 'grade-lesson-units', 'grade-lesson-outcomes'];

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const params = request.nextUrl.searchParams;
  const scope = params.get('scope') as Scope | null;
  const gradeId = params.get('gradeId') ? Number(params.get('gradeId')) : null;
  const lessonId = params.get('lessonId') ? Number(params.get('lessonId')) : null;
  const unitId = params.get('unitId') ? Number(params.get('unitId')) : null;
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: 'Geçersiz scope' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const resolved = await resolveIds(supabase, scope, gradeId, lessonId, unitId);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  return NextResponse.json({ count: resolved.ids.length });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { scope?: unknown; gradeId?: unknown; lessonId?: unknown; unitId?: unknown }
    | null;
  const scope = body?.scope as Scope | undefined;
  const gradeId = body?.gradeId ? Number(body.gradeId) : null;
  const lessonId = body?.lessonId ? Number(body.lessonId) : null;
  const unitId = body?.unitId ? Number(body.unitId) : null;

  if (!scope || !VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: 'Geçersiz scope' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const resolved = await resolveIds(supabase, scope, gradeId, lessonId, unitId);
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  if (!resolved.ids.length) {
    return NextResponse.json({ deletedCount: 0, failed: [] });
  }

  // Konu/ünite silmeden önce altlarındaki sorular temizlenmezse, sorular topic_id'ye
  // bağlı kaldığı için silme FK hatasıyla engellenir. "Tüm Konuları/Üniteleri Sil"
  // gerçek anlamda o kapsamı tamamen temizlemeyi vaat ettiği için, engelleyici sorular
  // önce otomatik silinir — admin'in ayrıca "Soruları Sil"e basmasına gerek kalmaz.
  if (scope === 'unit-topics' || scope === 'grade-lesson-units') {
    const topicIds =
      scope === 'unit-topics'
        ? resolved.ids
        : ((await supabase.from('topics').select('id').in('unit_id', resolved.ids)).data as { id: number }[] | null || []).map((r) => r.id);
    const questionIds = await questionIdsForTopics(supabase, topicIds);
    if (questionIds.length) await deleteQuestionsCascade(supabase, questionIds);
  }

  const result =
    resolved.table === 'questions'
      ? await deleteQuestionsCascade(supabase, resolved.ids)
      : resolved.table === 'topic_contents'
        ? await deleteTopicContentsCascade(supabase, resolved.ids)
        : resolved.table === 'topics'
          ? await deleteTopicsCascade(supabase, resolved.ids)
          : resolved.table === 'outcomes'
            ? await deleteOutcomesCascade(supabase, resolved.ids)
            : await deleteUnitsCascade(supabase, resolved.ids);

  return NextResponse.json({ deletedCount: result.deletedIds.length, failed: result.failed });
}
