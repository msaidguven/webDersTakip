import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type DraftRow = {
  id: number;
  topic_id: number;
  unit_id: number;
  lesson_id: number;
  grade_id: number;
  ai_model: string | null;
  cover: { subtitle?: string; highlights?: { icon: string | null; title: string; description: string }[] } | null;
  sections: unknown;
  summary_markdown: string | null;
  discussion_prompt_markdown: string | null;
  created_at: string;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();

  const { data: draftsData, error } = await supabase
    .from('topic_section_content_drafts')
    .select('id, topic_id, unit_id, lesson_id, grade_id, ai_model, cover, sections, summary_markdown, discussion_prompt_markdown, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const drafts = (draftsData as DraftRow[] | null) || [];
  if (!drafts.length) return NextResponse.json({ drafts: [] });

  const topicIds = [...new Set(drafts.map((d) => d.topic_id))];
  const unitIds = [...new Set(drafts.map((d) => d.unit_id))];
  const lessonIds = [...new Set(drafts.map((d) => d.lesson_id))];
  const gradeIds = [...new Set(drafts.map((d) => d.grade_id))];

  const [{ data: topics }, { data: units }, { data: lessons }, { data: grades }] = await Promise.all([
    supabase.from('topics').select('id, title').in('id', topicIds),
    supabase.from('units').select('id, title').in('id', unitIds),
    supabase.from('lessons').select('id, name').in('id', lessonIds),
    supabase.from('grades').select('id, name').in('id', gradeIds),
  ]);

  const topicById = new Map(((topics as { id: number; title: string }[] | null) || []).map((t) => [t.id, t.title]));
  const unitById = new Map(((units as { id: number; title: string }[] | null) || []).map((u) => [u.id, u.title]));
  const lessonById = new Map(((lessons as { id: number; name: string }[] | null) || []).map((l) => [l.id, l.name]));
  const gradeById = new Map(((grades as { id: number; name: string }[] | null) || []).map((g) => [g.id, g.name]));

  const result = drafts.map((d) => ({
    id: d.id,
    topicId: d.topic_id,
    aiModel: d.ai_model,
    cover: d.cover,
    sections: d.sections,
    summaryMarkdown: d.summary_markdown,
    discussionPromptMarkdown: d.discussion_prompt_markdown,
    createdAt: d.created_at,
    topicTitle: topicById.get(d.topic_id) || '',
    unitTitle: unitById.get(d.unit_id) || '',
    lessonName: lessonById.get(d.lesson_id) || '',
    gradeName: gradeById.get(d.grade_id) || '',
  }));

  return NextResponse.json({ drafts: result });
}
