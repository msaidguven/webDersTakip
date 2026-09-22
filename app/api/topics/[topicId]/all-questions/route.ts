import { NextRequest, NextResponse } from 'next/server';
import { getAllTopicQuestions, getTopicTestQuestions } from '@/app/src/lib/quizQuestions';
import { createClient } from '@/utils/supabase/server';

// Sunum modunun "soru çöz" adımı (SlidePlayer) için. Giriş yapmışsa (öğrenci evde kendi
// başına çalışıyor, kullanıcının 2026-09-22 isteği): getTopicTestQuestions ile AYNI
// kişiselleştirilmiş/10 soruluk seçim (önce hiç çözülmemiş, sonra SRS tekrar vakti gelmiş) —
// bitince SlidePlayer "Yeni 10 Soru Çöz" ile bu uç noktayı tekrar çağırıp bir sonraki
// partiyi alır. Misafirde (akıllı tahtadaki tipik kullanım — öğretmen giriş yapmadan tüm
// sınıfa sırayla çözdürüyor) kişiselleştirme/limit YOK, konunun tüm aktif soruları id
// sırasıyla döner (eski davranış).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { questions, allCaughtUp } = await getTopicTestQuestions(topicId, user.id);
    return NextResponse.json({ questions, allCaughtUp, personalized: true });
  }

  const questions = await getAllTopicQuestions(topicId);
  return NextResponse.json({ questions, allCaughtUp: false, personalized: false });
}
