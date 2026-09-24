import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteOutcomesCascade } from '@/app/src/lib/adminCascade';

const EDITABLE_FIELDS = ['description', 'code', 'order_index', 'learning_outcome_id'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const topicId = request.nextUrl.searchParams.get('topicId');
  const search = request.nextUrl.searchParams.get('search');

  if (!topicId && !search) {
    return NextResponse.json({ items: [] });
  }

  // order_index her konuda 1'den başlar (konuya özel); topicId verilmeden (search ile) birden
  // fazla konu döndüğünde SADECE order_index'e göre sıralamak farklı konuların kazanımlarını
  // birbirine karıştırır — önce topic_id'ye göre grupluyoruz ki her konunun kazanımları en
  // azından kendi içinde bir arada ve doğru sırada kalsın.
  let query = supabase
    .from('outcomes')
    .select('id, topic_id, description, order_index, code, topics(title)')
    .order('topic_id', { ascending: true })
    .order('order_index', { ascending: true })
    .limit(300);

  if (topicId) query = query.eq('topic_id', topicId);
  if (search) query = query.ilike('description', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

// TYMM karşılaştırma ekranından "bu kazanımı ekle" ile tetikleniyor (kullanıcının
// 2026-09-20 isteği) — description zorunlu, code admin sonra elle girer. order_index
// verilmezse konudaki en yüksek değerin bir fazlası kullanılır (listenin sonuna eklenir).
// learningOutcomeId verilirse (kullanıcının 2026-09-24 isteği: "sol tarafta öğrenme
// çıktılarının altına kazanım ekleyip silebilmeliyim") kazanım doğrudan o gruba bağlı
// oluşturulur — PATCH'teki learning_outcome_id doğrulamasıyla AYNI kural: grup gerçekten
// aynı konuya ait olmalı.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as
    { topicId?: unknown; description?: unknown; learningOutcomeId?: unknown; orderIndex?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const learningOutcomeId = typeof body?.learningOutcomeId === 'number' ? body.learningOutcomeId : null;
  const explicitOrderIndex = typeof body?.orderIndex === 'number' ? body.orderIndex : null;

  if (!topicId || !Number.isInteger(topicId) || !description) {
    return NextResponse.json({ error: 'topicId ve description zorunlu' }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (learningOutcomeId != null) {
    const { data: groupRow, error: groupErr } = await supabase
      .from('topic_learning_outcomes')
      .select('id, topic_id')
      .eq('id', learningOutcomeId)
      .maybeSingle();
    if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });
    if (!groupRow) return NextResponse.json({ error: 'Öğrenme çıktısı grubu bulunamadı' }, { status: 404 });
    if ((groupRow as { topic_id: number }).topic_id !== topicId) {
      return NextResponse.json({ error: 'Öğrenme çıktısı grubu farklı bir konuya ait' }, { status: 400 });
    }
  }

  let orderIndex = explicitOrderIndex;
  if (orderIndex == null) {
    const { data: maxRow } = await supabase
      .from('outcomes')
      .select('order_index')
      .eq('topic_id', topicId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    orderIndex = ((maxRow as { order_index: number | null } | null)?.order_index ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from('outcomes')
    .insert({ topic_id: topicId, description, order_index: orderIndex, learning_outcome_id: learningOutcomeId })
    .select('id, topic_id, description, order_index, code, learning_outcome_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; patch?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;

  if (!ids.length || !rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // learning_outcome_id ile bir kazanımı bir öğrenme çıktısı grubuna BAĞLARKEN, grubun
  // gerçekten aynı konuya (topic) ait olduğunu doğruluyoruz — aksi halde admin'in ekranda
  // yanlışlıkla başka bir konunun grubunu seçmesi, kazanımı sessizce yanlış konuya
  // "taşınmış" gibi göstermez (kazanımın kendi topic_id'si değişmiyor, sadece grubu yanlış
  // olur ve karşılaştırma ekranı bunu tutarsız gösterir).
  if ('learning_outcome_id' in patch && patch.learning_outcome_id != null) {
    const groupId = Number(patch.learning_outcome_id);
    const [{ data: groupRow, error: groupErr }, { data: outcomeRows, error: outcomesErr }] = await Promise.all([
      supabase.from('topic_learning_outcomes').select('id, topic_id').eq('id', groupId).maybeSingle(),
      supabase.from('outcomes').select('id, topic_id').in('id', ids),
    ]);
    if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 });
    if (outcomesErr) return NextResponse.json({ error: outcomesErr.message }, { status: 500 });
    if (!groupRow) return NextResponse.json({ error: 'Öğrenme çıktısı grubu bulunamadı' }, { status: 404 });
    const groupTopicId = (groupRow as { topic_id: number }).topic_id;
    const mismatched = ((outcomeRows as { id: number; topic_id: number }[] | null) || []).some((o) => o.topic_id !== groupTopicId);
    if (mismatched) return NextResponse.json({ error: 'Kazanım ve öğrenme çıktısı grubu farklı konulara ait' }, { status: 400 });
  }

  const { error } = await supabase.from('outcomes').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const result = await deleteOutcomesCascade(supabase, ids);
  return NextResponse.json(result);
}
