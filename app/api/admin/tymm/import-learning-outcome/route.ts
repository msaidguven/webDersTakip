import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { fetchTymmUnitForTopic } from '@/app/src/lib/tymm/fetchTymmUnitForTopic';
import { importLearningOutcomeIntoTopic } from '@/app/src/lib/tymm/importLearningOutcome';

// Kazanım Yönetimi paneli — admin "Ekle" dediğinde: TYMM'i yeniden (canlı) çekip seçilen
// öğrenme çıktısını (kod+başlıkla tanımlı) bulur ve tek bu konuya, altındaki TÜM kazanım
// bileşenleriyle birlikte yazar. Yeniden çekmek (önceki GET'in sonucunu güvenmek yerine)
// bilerek — TYMM sayfası admin ekranı açıkken değişmiş olabilir, "Ekle" tıklandığı anda
// gerçekten ne varsa onu yazmak istiyoruz.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; code?: unknown; title?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  const code = typeof body?.code === 'string' ? body.code : '';
  const title = typeof body?.title === 'string' ? body.title : '';
  if (!Number.isInteger(topicId) || !title) {
    return NextResponse.json({ error: 'topicId ve title zorunlu' }, { status: 400 });
  }

  const tymmResult = await fetchTymmUnitForTopic(topicId);
  if (!tymmResult.ok) return NextResponse.json({ error: tymmResult.error }, { status: 400 });

  const learningOutcome = tymmResult.tymmUnit.learningOutcomes.find((lo) => (lo.code || '') === code && lo.title === title);
  if (!learningOutcome) {
    return NextResponse.json({ error: "TYMM'de bu öğrenme çıktısı artık bulunamadı — sayfa değişmiş olabilir, listeyi yenileyin." }, { status: 404 });
  }

  const result = await importLearningOutcomeIntoTopic(topicId, learningOutcome, tymmResult.curriculumYear);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json(result);
}
