import { NextResponse } from 'next/server';
import { getAllTopicQuestions } from '@/app/src/lib/quizQuestions';
import { publicApiCacheHeaders } from '@/app/src/lib/publicApiCache';

// Misafir konu testinin (GuestTopicTest) soru havuzu: konunun tüm aktif soruları id sırasıyla;
// hangi 10 sorunun gösterileceğini istemci seçer. Oturuma bakmaz → herkese aynı yanıt, CDN'de bir
// sonraki pazartesi 03:00 TR'ye kadar önbellekli (bkz. publicApiCache.ts). Üyelerin testi
// kişiselleştirilmiş seçimle /api/soru-bankasi/topic-test üzerinden açılır (2026-10-23 birleştirme;
// eskiden slayt oynatıcısı buradan kişiselleştirilmiş parti de istiyordu).
export async function GET(_request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  const { topicId: topicIdParam } = await params;
  const topicId = Number(topicIdParam);
  if (!topicId || !Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'Geçersiz konu' }, { status: 400 });
  }

  const questions = await getAllTopicQuestions(topicId);
  return NextResponse.json({ questions }, { headers: publicApiCacheHeaders() });
}
