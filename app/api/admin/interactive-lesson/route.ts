import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { narrationManifestPath, narrationPublicUrl } from '@/app/src/lib/narration/config';
import type { NarrationManifest } from '@/app/src/lib/narration/types';
import { getAllTopicQuestions } from '@/app/src/lib/quizQuestions';
import type { MultipleChoiceQuestion } from '@/app/src/lib/quizQuestionTypes';
import { generateSlideDeck } from '@/app/src/lib/topicSlideDeck';

// Etkileşimli ders (yalnızca admin önizlemesi): anlatım manifesti + anahtar kavram görselleri +
// 2 çoktan seçmeli soru (doğru cevap YOK, cevap /answer'da sunucuda kontrol edilir) + slayt etkinliği.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId) || topicId <= 0) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [manifestRes, visualsRes, questions, deck] = await Promise.all([
    fetch(narrationPublicUrl(narrationManifestPath(topicId)), { cache: 'no-store' }),
    supabase.from('topic_narration_visuals').select('term, image_url').eq('topic_id', topicId),
    getAllTopicQuestions(topicId),
    generateSlideDeck(supabase, topicId),
  ]);

  if (!manifestRes.ok) return NextResponse.json({ error: 'Bu konunun sesli anlatımı hazır değil' }, { status: 404 });
  if (visualsRes.error) return NextResponse.json({ error: visualsRes.error.message }, { status: 500 });

  const manifest = (await manifestRes.json()) as NarrationManifest;
  const choiceQuestions = questions
    .filter((q): q is MultipleChoiceQuestion => q.type === 'multiple_choice')
    .slice(0, 2);
  const activity = deck.ok ? deck.deck.slides.find((slide) => slide.kind === 'activity') ?? null : null;

  return NextResponse.json({
    manifest,
    visuals: visualsRes.data ?? [],
    questions: choiceQuestions.map((q) => ({
      id: q.id,
      text: q.question_text,
      choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
    })),
    activity: activity ? { label: activity.label ?? null, heading: activity.heading, reveal: activity.reveal ?? null } : null,
  });
}
