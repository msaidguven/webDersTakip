import type { SupabaseClient } from '@supabase/supabase-js';

export type SavedItemKind = 'note' | 'topic' | 'question';

export interface SavedStudyItem {
  id: number;
  kind: SavedItemKind;
  gradeName: string | null;
  lessonName: string | null;
  unitTitle: string | null;
  topicTitle: string | null;
  sectionHeading: string | null;
  excerpt: string | null;
  href: string;
  isPublic: boolean;
  createdAt: string;
}

type SavedItemRow = {
  id: number;
  kind: SavedItemKind;
  grade_name: string | null;
  lesson_name: string | null;
  unit_title: string | null;
  topic_title: string | null;
  section_heading: string | null;
  excerpt: string | null;
  href: string;
  is_public: boolean;
  created_at: string;
};

function mapRows(rows: SavedItemRow[] | null | undefined): SavedStudyItem[] {
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    gradeName: r.grade_name,
    lessonName: r.lesson_name,
    unitTitle: r.unit_title,
    topicTitle: r.topic_title,
    sectionHeading: r.section_heading,
    excerpt: r.excerpt,
    href: r.href,
    isPublic: r.is_public,
    createdAt: r.created_at,
  }));
}

export async function fetchPublicSavedItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  slug: string
): Promise<SavedStudyItem[]> {
  const { data, error } = await supabase.rpc('get_public_saved_items', { p_slug: slug });
  if (error) return [];
  return mapRows(data as SavedItemRow[] | null);
}

export async function fetchMySavedItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<SavedStudyItem[]> {
  const { data, error } = await supabase.rpc('get_my_saved_items');
  if (error) return [];
  return mapRows(data as SavedItemRow[] | null);
}

export async function saveStudyItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    kind: SavedItemKind;
    topicId?: number | null;
    questionId?: number | null;
    sectionHeading?: string | null;
    sectionAnchor?: string | null;
    excerpt?: string | null;
    toggle?: boolean;
  }
): Promise<{ itemId: number; isSaved: boolean }> {
  const { data, error } = await supabase.rpc('save_student_item', {
    p_kind: input.kind,
    p_topic_id: input.topicId ?? null,
    p_question_id: input.questionId ?? null,
    p_section_heading: input.sectionHeading ?? null,
    p_section_anchor: input.sectionAnchor ?? null,
    p_excerpt: input.excerpt ?? null,
    p_toggle: input.toggle ?? false,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? (data[0] as { item_id: number; is_saved: boolean } | undefined) : undefined;
  return { itemId: Number(row?.item_id ?? 0), isSaved: Boolean(row?.is_saved) };
}

export async function deleteStudyItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  id: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_student_item', { p_id: id });
  if (error) throw error;
  return Boolean(data);
}

export async function setStudyItemVisibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  id: number,
  isPublic: boolean
): Promise<boolean> {
  const { data, error } = await supabase.rpc('set_student_item_visibility', {
    p_id: id,
    p_is_public: isPublic,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchMySavedRefs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  opts: { topicId?: number | null; questionIds?: number[] | null }
): Promise<{ topicSaved: boolean; savedQuestionIds: Set<number> }> {
  const { data, error } = await supabase.rpc('get_my_saved_refs', {
    p_topic_id: opts.topicId ?? null,
    p_question_ids: opts.questionIds?.length ? opts.questionIds : null,
  });
  if (error) return { topicSaved: false, savedQuestionIds: new Set() };
  const row = Array.isArray(data)
    ? (data[0] as { topic_saved: boolean; saved_question_ids: number[] | null } | undefined)
    : undefined;
  return {
    topicSaved: Boolean(row?.topic_saved),
    savedQuestionIds: new Set((row?.saved_question_ids ?? []).map(Number)),
  };
}
