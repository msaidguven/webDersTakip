import type { SupabaseClient } from '@supabase/supabase-js';

export type SavedItemKind = 'note' | 'topic' | 'question';

export type SavedQuestionType = 'multiple_choice' | 'blank' | 'classical' | 'other';

export interface SavedQuestionChoice {
  id: number;
  text: string;
  isCorrect: boolean;
}

export interface SavedQuestionSrs {
  lastAnswerCorrect: boolean;
  lastAnswerAt: string | null;
  nextReviewAt: string | null;
  selectedOptionId: number | null;
}

export interface SavedQuestionPayload {
  questionId: number;
  questionType: SavedQuestionType;
  questionText: string;
  passage: string | null;
  solutionText: string | null;
  modelAnswer: string | null;
  choices: SavedQuestionChoice[];
  srs: SavedQuestionSrs | null;
}

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
  question: SavedQuestionPayload | null;
}

type RawChoice = {
  id: number | string;
  text: string;
  is_correct: boolean;
};

type RawSrs = {
  last_answer_correct: boolean;
  last_answer_at: string | null;
  next_review_at: string | null;
  selected_option_id: number | string | null;
};

type RawQuestionPayload = {
  question_id: number | string;
  question_type: SavedQuestionType;
  question_text: string;
  passage?: string | null;
  solution_text?: string | null;
  model_answer?: string | null;
  choices?: RawChoice[] | null;
  srs?: RawSrs | null;
};

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
  question_payload?: RawQuestionPayload | null;
};

function mapQuestionPayload(raw: RawQuestionPayload | null | undefined): SavedQuestionPayload | null {
  if (!raw || !raw.question_id) return null;
  const choices: SavedQuestionChoice[] = Array.isArray(raw.choices)
    ? raw.choices.map((c) => ({
        id: Number(c.id),
        text: c.text,
        isCorrect: Boolean(c.is_correct),
      }))
    : [];
  const srs: SavedQuestionSrs | null = raw.srs
    ? {
        lastAnswerCorrect: Boolean(raw.srs.last_answer_correct),
        lastAnswerAt: raw.srs.last_answer_at ?? null,
        nextReviewAt: raw.srs.next_review_at ?? null,
        selectedOptionId: raw.srs.selected_option_id != null ? Number(raw.srs.selected_option_id) : null,
      }
    : null;
  return {
    questionId: Number(raw.question_id),
    questionType: raw.question_type ?? 'other',
    questionText: raw.question_text ?? '',
    passage: raw.passage ?? null,
    solutionText: raw.solution_text ?? null,
    modelAnswer: raw.model_answer ?? null,
    choices,
    srs,
  };
}

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
    question: mapQuestionPayload(r.question_payload),
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

export interface ProfileQuestionAnswerResult {
  recorded: boolean;
  reason: string | null;
  isCorrect: boolean;
  correctOptionId: number | null;
  nextReviewAt: string | null;
  lastAnswerAt: string | null;
}

export async function submitProfileQuestionAnswer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { questionId: number; selectedOptionId: number }
): Promise<ProfileQuestionAnswerResult | null> {
  const { data, error } = await supabase.rpc('submit_profile_question_answer', {
    p_question_id: input.questionId,
    p_selected_option_id: input.selectedOptionId,
  });
  if (error || !data) return null;
  const raw = data as {
    recorded?: boolean;
    reason?: string | null;
    is_correct?: boolean;
    correct_option_id?: number | string | null;
    next_review_at?: string | null;
    last_answer_at?: string | null;
  };
  return {
    recorded: Boolean(raw.recorded),
    reason: raw.reason ?? null,
    isCorrect: Boolean(raw.is_correct),
    correctOptionId: raw.correct_option_id != null ? Number(raw.correct_option_id) : null,
    nextReviewAt: raw.next_review_at ?? null,
    lastAnswerAt: raw.last_answer_at ?? null,
  };
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
