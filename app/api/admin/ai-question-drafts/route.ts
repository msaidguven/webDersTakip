import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin panelindeki "AI Soru Taslakları" sekmesi (bkz. AiQuestionDraftsPanel.tsx) —
// SADECE onay bekleyen (pending) taslakları, gösterim için gerekli sınıf/ders/ünite/
// konu/alt başlık bilgisiyle birlikte döner.
type DraftRow = {
  id: number;
  section_id: number;
  topic_id: number;
  unit_id: number;
  lesson_id: number;
  grade_id: number;
  ai_model: string | null;
  questions: unknown;
  created_at: string;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();

  const { data: draftsData, error } = await supabase
    .from('ai_question_drafts')
    .select('id, section_id, topic_id, unit_id, lesson_id, grade_id, ai_model, questions, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const drafts = (draftsData as DraftRow[] | null) || [];
  if (!drafts.length) return NextResponse.json({ drafts: [] });

  const sectionIds = [...new Set(drafts.map((d) => d.section_id))];
  const topicIds = [...new Set(drafts.map((d) => d.topic_id))];
  const unitIds = [...new Set(drafts.map((d) => d.unit_id))];
  const lessonIds = [...new Set(drafts.map((d) => d.lesson_id))];
  const gradeIds = [...new Set(drafts.map((d) => d.grade_id))];

  const [{ data: sections }, { data: topics }, { data: units }, { data: lessons }, { data: grades }] = await Promise.all([
    supabase.from('topic_content_sections').select('id, heading').in('id', sectionIds),
    supabase.from('topics').select('id, title').in('id', topicIds),
    supabase.from('units').select('id, title').in('id', unitIds),
    supabase.from('lessons').select('id, name').in('id', lessonIds),
    supabase.from('grades').select('id, name').in('id', gradeIds),
  ]);

  const headingById = new Map(((sections as { id: number; heading: string }[] | null) || []).map((s) => [s.id, s.heading]));
  const topicTitleById = new Map(((topics as { id: number; title: string }[] | null) || []).map((t) => [t.id, t.title]));
  const unitTitleById = new Map(((units as { id: number; title: string }[] | null) || []).map((u) => [u.id, u.title]));
  const lessonNameById = new Map(((lessons as { id: number; name: string }[] | null) || []).map((l) => [l.id, l.name]));
  const gradeNameById = new Map(((grades as { id: number; name: string }[] | null) || []).map((g) => [g.id, g.name]));

  const result = drafts.map((d) => ({
    id: d.id,
    sectionId: d.section_id,
    aiModel: d.ai_model,
    questions: d.questions,
    createdAt: d.created_at,
    heading: headingById.get(d.section_id) || '',
    topicTitle: topicTitleById.get(d.topic_id) || '',
    unitTitle: unitTitleById.get(d.unit_id) || '',
    lessonName: lessonNameById.get(d.lesson_id) || '',
    gradeName: gradeNameById.get(d.grade_id) || '',
  }));

  return NextResponse.json({ drafts: result });
}
