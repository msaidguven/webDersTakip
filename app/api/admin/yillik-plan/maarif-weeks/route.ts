import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseMaarifPlan } from '@/app/src/lib/yillikPlan/maarifPlanParser';
import { matchMaarifPlan, weekRowsToWrite, type DbUnit } from '@/app/src/lib/yillikPlan/matchMaarifPlan';

type UnitRow = {
  id: number;
  title: string;
  order_no: number;
  topics: {
    id: number;
    title: string;
    order_no: number;
    topic_learning_outcomes: { id: number; code: string | null }[];
    outcomes: {
      id: number;
      code: string | null;
      description: string;
      order_index: number | null;
      learning_outcome_id: number | null;
      is_current: boolean;
      outcome_weeks: { start_week: number; end_week: number }[];
    }[];
  }[];
};

// Maarif formatındaki yıllık plan DOCX'inden seçili ders+sınıfın TÜM kazanımlarına hafta atar
// (bkz. matchMaarifPlan.ts). commit=false: sadece önizleme. commit=true: aynı eşleştirmeyi
// sunucuda yeniden yapıp (dosya her istekte yeniden ayrıştırılır, istemciye güvenilmez) tek
// transaction'da yazar — apply_yearly_plan_weeks RPC'si.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const gradeId = Number(form?.get('gradeId'));
  const lessonId = Number(form?.get('lessonId'));
  const commit = form?.get('commit') === 'true';
  if (!file || typeof file === 'string' || !file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: '.docx dosyası zorunlu' }, { status: 400 });
  }
  if (!Number.isInteger(gradeId) || !Number.isInteger(lessonId)) {
    return NextResponse.json({ error: 'Sınıf ve ders zorunlu' }, { status: 400 });
  }

  const plan = await parseMaarifPlan(Buffer.from(await file.arrayBuffer())).catch(() => null);
  if (!plan) return NextResponse.json({ error: 'Dosya Maarif yıllık plan formatında değil (kodlu süreç bileşeni bulunamadı).' }, { status: 400 });

  const supabase = createServiceClient();
  const [{ data: grade }, { data: unitsData, error: unitsErr }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase
      .from('units')
      .select(
        'id, title, order_no, topics(id, title, order_no, topic_learning_outcomes(id, code), outcomes(id, code, description, order_index, learning_outcome_id, is_current, outcome_weeks(start_week, end_week)))'
      )
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .order('order_no', { ascending: true }),
  ]);
  if (unitsErr) return NextResponse.json({ error: unitsErr.message }, { status: 500 });

  const units: DbUnit[] = ((unitsData as UnitRow[] | null) || []).map((u) => ({
    id: u.id,
    title: u.title,
    orderNo: u.order_no,
    topics: [...u.topics]
      .sort((a, b) => a.order_no - b.order_no || a.id - b.id)
      .map((t) => ({
        id: t.id,
        title: t.title,
        orderNo: t.order_no,
        learningOutcomes: t.topic_learning_outcomes,
        outcomes: t.outcomes
          .filter((o) => o.is_current)
          .map((o) => ({
            id: o.id,
            letter: o.code?.trim() || null,
            description: o.description,
            orderIndex: o.order_index,
            learningOutcomeId: o.learning_outcome_id,
            weeks: o.outcome_weeks.map((w) => ({ start: w.start_week, end: w.end_week })),
          })),
      })),
  }));

  const gradeNo = Number(/^(\d+)/.exec((grade as { name: string } | null)?.name ?? '')?.[1]) || null;
  const result = matchMaarifPlan(units, plan, gradeNo);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });

  if (!commit) return NextResponse.json({ result, planWeekCount: plan.weekCount });

  const { data: written, error: rpcErr } = await supabase.rpc('apply_yearly_plan_weeks', {
    p_links: result.links.map((l) => ({ topic_id: l.topicId, code: l.code, title: l.title, order_no: l.orderNo, outcome_ids: l.outcomeIds })),
    p_weeks: weekRowsToWrite(result),
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  return NextResponse.json({ result, written });
}
