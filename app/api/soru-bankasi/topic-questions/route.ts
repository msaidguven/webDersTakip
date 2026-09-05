// app/api/soru-bankasi/topic-questions/route.ts
// Soru bankası ünite sayfasındaki accordion'un (bkz. [unite]/page.tsx) bir konuyu açtığında
// o konunun sorularını gecikmeli (lazy) çekmesi için — ünitedeki TÜM konuların sorularını
// baştan tek sayfada render etmek performans sorunu olurdu (bazı ünitelerde 180'e varan soru
// var, bkz. [[project_soru_sayfalari_simplification]]). Konu sayfasıyla (bkz.
// [konu]/page.tsx) BİREBİR AYNI veri fonksiyonlarını kullanıyor, davranış farkı yok — sadece
// tam sayfa navigasyonu yerine fetch ile geliyor. Public: soru bankası zaten herkese açık
// (is_active filtreli), auth gerekmiyor.
import { NextRequest, NextResponse } from 'next/server';
import { getAllTopicQuestions, getQuestionCommentCounts } from '@/app/src/lib/quizQuestions';

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId || !Number.isFinite(Number(topicId))) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const questions = await getAllTopicQuestions(topicId);
  const commentCounts = await getQuestionCommentCounts(questions.map((q) => q.id));

  return NextResponse.json({ questions, commentCounts });
}
