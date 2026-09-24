import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { fetchTymmUnitForTopic } from '@/app/src/lib/tymm/fetchTymmUnitForTopic';
import { fuzzyNorm } from '@/app/src/lib/tymm/compareUnits';

// Kazanım Yönetimi paneli — SEÇİLİ TEK KONU için: DB'deki öğrenme çıktısı gruplarını
// (topic_learning_outcomes + altındaki kazanımlar), bağsız (learning_outcome_id null)
// kazanımları, ve TYMM'in canlı sayfasında bu konuya ait olup DB'de henüz karşılığı
// olmayan öğrenme çıktısı adaylarını döner. Hiçbir şey yazmaz.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = Number(request.nextUrl.searchParams.get('topicId'));
  if (!Number.isInteger(topicId)) return NextResponse.json({ error: 'topicId zorunlu' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topicRow, error: topicErr } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 });
  if (!topicRow) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { data: groupsData, error: groupsErr } = await supabase
    .from('topic_learning_outcomes')
    .select('id, code, title, order_no, outcomes(id, code, description, order_index)')
    .eq('topic_id', topicId)
    .eq('outcomes.is_current', true)
    .order('order_no', { ascending: true });
  if (groupsErr) return NextResponse.json({ error: groupsErr.message }, { status: 500 });

  const { data: ungroupedData, error: ungroupedErr } = await supabase
    .from('outcomes')
    .select('id, code, description, order_index')
    .eq('topic_id', topicId)
    .eq('is_current', true)
    .is('learning_outcome_id', null)
    .order('order_index', { ascending: true });
  if (ungroupedErr) return NextResponse.json({ error: ungroupedErr.message }, { status: 500 });

  const groups = ((groupsData as { id: number; code: string | null; title: string; order_no: number; outcomes: { id: number; code: string | null; description: string; order_index: number }[] }[] | null) || []).map(
    (g) => ({ ...g, outcomes: [...g.outcomes].sort((a, b) => a.order_index - b.order_index) })
  );

  const tymmResult = await fetchTymmUnitForTopic(topicId);
  if (!tymmResult.ok) {
    return NextResponse.json({ topic: topicRow, groups, ungroupedOutcomes: ungroupedData || [], tymmCandidates: [], tymmError: tymmResult.error });
  }

  // ÜNİTE genelinde hangi kodların ZATEN bir konuya bağlı olduğunu buluyoruz (SADECE bu
  // konununkiler değil) — çünkü TYMM'in kendi topicTitle tahmini, "içerik çerçevesi satır
  // sayısı ≠ öğrenme çıktısı sayısı" durumunda güvenilmez (bkz. fetchLessonTymmTopics.ts'teki
  // aynı bilinen sorun, ve compareUnits.ts'in dosya başı yorumu: "TAHMİN/HESAP YOK" kararı,
  // kullanıcının 5. Sınıf Sosyal Bilgiler "Ortak Mirasımız" ünitesinde canlı doğrulanan
  // gerçek örnek — 4 konuya 3 öğrenme çıktısı düşüyor, topicTitle üçüncü konudan itibaren
  // kayıyor). Bu yüzden adayları KODA göre "ünitede hiçbir yerde kullanılmıyor mu" diye
  // filtreliyoruz, konuya göre DEĞİL — hangi konuya ait olduğuna admin burada karar verir.
  const { data: unitGroupsData, error: unitGroupsErr } = await supabase
    .from('topic_learning_outcomes')
    .select('code, topics!inner(unit_id)')
    .eq('topics.unit_id', (topicRow as { unit_id: number }).unit_id);
  if (unitGroupsErr) return NextResponse.json({ error: unitGroupsErr.message }, { status: 500 });
  const usedCodesInUnit = new Set(
    ((unitGroupsData as { code: string | null }[] | null) || []).map((g) => (g.code ? fuzzyNorm(g.code) : null)).filter((c): c is string => c != null)
  );

  const topicTitleFuzzy = fuzzyNorm((topicRow as { title: string }).title);
  const tymmCandidates = tymmResult.tymmUnit.learningOutcomes
    .filter((lo) => !(lo.code && usedCodesInUnit.has(fuzzyNorm(lo.code))))
    .map((lo) => ({ code: lo.code, title: lo.title, topicTitle: lo.topicTitle, likelyMatch: fuzzyNorm(lo.topicTitle) === topicTitleFuzzy, components: lo.components }))
    .sort((a, b) => Number(b.likelyMatch) - Number(a.likelyMatch));

  return NextResponse.json({ topic: topicRow, groups, ungroupedOutcomes: ungroupedData || [], tymmCandidates, unitTitle: tymmResult.unitTitle });
}
