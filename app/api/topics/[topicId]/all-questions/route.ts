import { NextRequest, NextResponse } from 'next/server';
import { getAllTopicQuestions } from '@/app/src/lib/quizQuestions';

// Sunum modunun "soru çöz" adımı (SlidePlayer) için — kişiselleştirme/limit yok, konunun
// TÜM aktif sorularını (klasik/açık uçlu hariç — bkz. getAllTopicQuestions notu) sırayla
// döndürür. İstatistik/oturum tutulmuyor, öğretmen akıllı tahtada sırayla çözdürüyor.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const questions = await getAllTopicQuestions(topicId);
  return NextResponse.json({ questions });
}
