import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getWeekDateRange } from '@/app/src/lib/routeParsing';
import { parseMaarifPlan } from '@/app/src/lib/yillikPlan/maarifPlanParser';
import { checkWeekSequence, matchMaarifPlan, PLANNING_WEEK_TITLE, weekRowsToWrite, type DbUnit } from '@/app/src/lib/yillikPlan/matchMaarifPlan';

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

type Service = ReturnType<typeof createServiceClient>;
type PlanningRow = { id: number; grade_ids: number[] | null };

// Yerel takvim günü (toISOString UTC'ye kaydırıp bir gün geri atabiliyor).
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Dosyadaki Okul Temelli Planlama haftalarını bu ders için özel hafta yapar (bkz. checkWeekSequence):
// aynı ders+haftada kayıt varsa yalnız sınıf eklenir, yoksa yeni kayıt (tarih hafta numarasından).
async function addPlanningWeeks(supabase: Service, gradeId: number, lessonId: number, weeks: number[]) {
  if (!weeks.length) return { added: 0, extended: 0 };
  const [{ termStartDate, breaks }, { data, error }] = await Promise.all([
    getCurriculumCalendar(supabase),
    supabase
      .from('special_week_events')
      .select('id, grade_ids, curriculum_week')
      .eq('is_active', true)
      .eq('event_type', 'special_content')
      .eq('lesson_id', lessonId)
      .ilike('title', PLANNING_WEEK_TITLE)
      .in('curriculum_week', weeks),
  ]);
  if (error) throw error;
  const byWeek = new Map(((data as (PlanningRow & { curriculum_week: number })[] | null) ?? []).map((r) => [r.curriculum_week, r]));

  let added = 0;
  let extended = 0;
  for (const week of weeks) {
    const existing = byWeek.get(week);
    if (existing) {
      const { error: upErr } = await supabase
        .from('special_week_events')
        .update({ grade_ids: [...(existing.grade_ids ?? []), gradeId], updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (upErr) throw upErr;
      extended++;
      continue;
    }
    const { start, end } = getWeekDateRange(week, 52, termStartDate, breaks);
    const { error: insErr } = await supabase.from('special_week_events').insert({
      event_type: 'special_content',
      title: PLANNING_WEEK_TITLE,
      content_html: 'Okul Temelli Planlama haftası: bu hafta yeni kazanım işlenmez.',
      curriculum_week: week,
      grade_id: gradeId,
      grade_ids: [gradeId],
      lesson_id: lessonId,
      is_active: true,
      priority: 5,
      start_date: ymd(start),
      end_date: ymd(end),
    });
    if (insErr) throw insErr;
    added++;
  }
  return { added, extended };
}

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
  const [{ data: grade }, { data: unitsData, error: unitsErr }, { data: specialData, error: specialErr }] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
    supabase
      .from('units')
      .select(
        'id, title, order_no, topics(id, title, order_no, topic_learning_outcomes(id, code), outcomes(id, code, description, order_index, learning_outcome_id, is_current, outcome_weeks(start_week, end_week)))'
      )
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .order('order_no', { ascending: true }),
    // Kazanımsız olabilecek haftalar (bkz. checkWeekSequence).
    supabase
      .from('special_week_events')
      .select('curriculum_week')
      .eq('is_active', true)
      .in('event_type', ['special_content', 'social_activity'])
      .not('curriculum_week', 'is', null)
      .or(`lesson_id.is.null,lesson_id.eq.${lessonId}`)
      .or(`grade_ids.is.null,grade_ids.cs.{${gradeId}}`),
  ]);
  if (unitsErr || specialErr) return NextResponse.json({ error: (unitsErr ?? specialErr)!.message }, { status: 500 });

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
  const specialWeeks = new Set(((specialData as { curriculum_week: number }[] | null) ?? []).map((r) => r.curriculum_week));
  const { error: sequenceError, planningWeeks } = checkWeekSequence(result, specialWeeks, plan.nonContentWeeks);
  if (sequenceError) return NextResponse.json({ error: sequenceError }, { status: 422 });

  if (!commit) return NextResponse.json({ result, planningWeeks, planWeekCount: plan.weekCount });

  const { data: written, error: rpcErr } = await supabase.rpc('apply_yearly_plan_weeks', {
    p_links: result.links.map((l) => ({ topic_id: l.topicId, code: l.code, title: l.title, order_no: l.orderNo, outcome_ids: l.outcomeIds })),
    p_weeks: weekRowsToWrite(result),
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  // Özel haftalar yalnız haftalar yazıldıktan sonra; başarısızsa haftalar yerinde kalır, aynı dosyayla
  // yeniden kaydetmek bu adımı tamamlar (haftalar değişmeden).
  try {
    const planning = await addPlanningWeeks(supabase, gradeId, lessonId, planningWeeks);
    return NextResponse.json({ result, planningWeeks, written: { ...(written as object), planning } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    return NextResponse.json({ error: `Haftalar yazıldı ama Okul Temelli Planlama özel haftası eklenemedi: ${message}. Aynı dosyayla tekrar kaydedin.` }, { status: 500 });
  }
}
