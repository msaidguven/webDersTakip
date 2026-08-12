import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type Option = { id: number; text: string; is_correct: boolean };
type Pair = { id: number; left_text: string; right_text: string };

type MultipleChoiceQuestion = { id: number; type: 'multiple_choice'; question_text: string; solution_text: string | null; choices: Option[] };
type BlankQuestion = { id: number; type: 'blank'; question_text: string; solution_text: string | null; options: Option[] };
type MatchingQuestion = { id: number; type: 'matching'; pairs: Pair[] };
type Question = MultipleChoiceQuestion | BlankQuestion | MatchingQuestion;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(request: NextRequest) {
  const sectionId = request.nextUrl.searchParams.get('sectionId');
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: sectionRow } = await supabase
    .from('topic_content_sections')
    .select('heading')
    .eq('id', sectionId)
    .maybeSingle();
  const heading = (sectionRow as { heading?: string } | null)?.heading || '';

  const { data: linkRows } = await supabase
    .from('topic_content_section_outcomes')
    .select('outcome_id')
    .eq('section_id', sectionId);
  const outcomeIds = ((linkRows as { outcome_id: number }[] | null) || []).map((r) => r.outcome_id);

  if (!outcomeIds.length) {
    return NextResponse.json({ heading, questions: [] as Question[] });
  }

  const { data: qoRows } = await supabase
    .from('question_outcomes')
    .select('question_id')
    .in('outcome_id', outcomeIds);
  const questionIds = Array.from(new Set(((qoRows as { question_id: number }[] | null) || []).map((r) => r.question_id)));

  if (!questionIds.length) {
    return NextResponse.json({ heading, questions: [] as Question[] });
  }

  const [{ data: questionsData }, { data: choicesData }, { data: optionsData }, { data: pairsData }] = await Promise.all([
    supabase.from('questions').select('id, question_text, solution_text, question_type_id').in('id', questionIds),
    supabase.from('question_choices').select('id, question_id, choice_text, is_correct').in('question_id', questionIds),
    supabase.from('question_blank_options').select('id, question_id, option_text, is_correct').in('question_id', questionIds),
    supabase.from('question_matching_pairs').select('id, question_id, left_text, right_text').in('question_id', questionIds),
  ]);

  const choicesByQuestion = new Map<number, Option[]>();
  ((choicesData as { id: number; question_id: number; choice_text: string; is_correct: boolean }[] | null) || []).forEach((c) => {
    const list = choicesByQuestion.get(c.question_id) || [];
    list.push({ id: c.id, text: c.choice_text, is_correct: c.is_correct });
    choicesByQuestion.set(c.question_id, list);
  });

  const optionsByQuestion = new Map<number, Option[]>();
  ((optionsData as { id: number; question_id: number; option_text: string; is_correct: boolean }[] | null) || []).forEach((o) => {
    const list = optionsByQuestion.get(o.question_id) || [];
    list.push({ id: o.id, text: o.option_text, is_correct: o.is_correct });
    optionsByQuestion.set(o.question_id, list);
  });

  const pairsByQuestion = new Map<number, Pair[]>();
  ((pairsData as { id: number; question_id: number; left_text: string; right_text: string }[] | null) || []).forEach((p) => {
    const list = pairsByQuestion.get(p.question_id) || [];
    list.push({ id: p.id, left_text: p.left_text, right_text: p.right_text });
    pairsByQuestion.set(p.question_id, list);
  });

  const all: Question[] = [];

  ((questionsData as { id: number; question_text: string; solution_text: string | null; question_type_id: number }[] | null) || []).forEach((q) => {
    if (q.question_type_id === 1) {
      const choices = shuffle(choicesByQuestion.get(q.id) || []);
      if (choices.length >= 2) all.push({ id: q.id, type: 'multiple_choice', question_text: q.question_text, solution_text: q.solution_text, choices });
      return;
    }
    if (q.question_type_id === 3) {
      const options = shuffle(optionsByQuestion.get(q.id) || []);
      if (options.length >= 2 && q.question_text.includes('_____')) {
        all.push({ id: q.id, type: 'blank', question_text: q.question_text, solution_text: q.solution_text, options });
      }
      return;
    }
    if (q.question_type_id === 4) {
      const pairs = shuffle(pairsByQuestion.get(q.id) || []);
      if (pairs.length >= 2) all.push({ id: q.id, type: 'matching', pairs });
    }
  });

  const questions = shuffle(all);

  return NextResponse.json({ heading, questions });
}
