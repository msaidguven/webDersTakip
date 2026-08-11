import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type Choice = { id: number; choice_text: string; is_correct: boolean };
type Question = { id: number; question_text: string; choices: Choice[] };

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

  const { data: questionsData } = await supabase
    .from('questions')
    .select('id, question_text')
    .in('id', questionIds);

  const { data: choicesData } = await supabase
    .from('question_choices')
    .select('id, question_id, choice_text, is_correct')
    .in('question_id', questionIds);

  const choicesByQuestion = new Map<number, Choice[]>();
  ((choicesData as { id: number; question_id: number; choice_text: string; is_correct: boolean }[] | null) || []).forEach((c) => {
    const list = choicesByQuestion.get(c.question_id) || [];
    list.push({ id: c.id, choice_text: c.choice_text, is_correct: c.is_correct });
    choicesByQuestion.set(c.question_id, list);
  });

  const withChoices = ((questionsData as { id: number; question_text: string }[] | null) || [])
    .map((q) => ({ id: q.id, question_text: q.question_text, choices: shuffle(choicesByQuestion.get(q.id) || []) }))
    .filter((q) => q.choices.length >= 2);

  const questions = shuffle(withChoices).slice(0, 5);

  return NextResponse.json({ heading, questions });
}
