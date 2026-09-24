import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Bir konuyu, public URL'ini (Google indeksini) BOZMADAN "arşive taşır" — TYMM müfredatı
// güncellendiğinde artık hiçbir üniteye karşılığı bulunamayan (bkz.
// app/src/lib/tymm/compareTopicsOnly.ts) bir konunun, admin "Toplu Sil → Tüm Üniteleri Sil"
// ile eski üniteleri temizlemeden ÖNCE soruları/kazanımları/içeriği kaybetmeden kenara
// alınması için. Konu ayrı, her (lesson_id, grade_id) için tek bir "Arşiv" ünitesine
// taşınır (unit_id güncellenir) ve is_archived=true işaretlenir; slug/title'a DOKUNULMAZ.
// Eski ünitenin slug'ı topics.frozen_unit_slug'a donuyor (bkz. supabase/migrations/
// topics_frozen_unit_slug.sql) — sayfa çözümleme ve sitemap/farkli-konular bu değeri varsa
// canlı ünitenin slug'ı yerine kullanır, konunun URL'i taşımadan hiç etkilenmez.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : null;
  if (!topicId) return NextResponse.json({ ok: false, error: 'topicId zorunlu' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topicRow, error: topicErr } = await supabase
    .from('topics')
    .select('id, unit_id, slug, is_archived, frozen_unit_slug')
    .eq('id', topicId)
    .maybeSingle();
  if (topicErr) return NextResponse.json({ ok: false, error: topicErr.message }, { status: 500 });
  const topic = topicRow as { id: number; unit_id: number; slug: string; is_archived: boolean; frozen_unit_slug: string | null } | null;
  if (!topic) return NextResponse.json({ ok: false, error: 'Konu bulunamadı' }, { status: 404 });

  // İkinci kez "Arşive Taşı" tıklanırsa (ör. sayfa yeniden yüklenip aynı listeden tekrar
  // basıldıysa) — ZATEN arşivdeyse ve frozen_unit_slug zaten donmuşsa hiçbir şeye
  // dokunmadan (yeniden dondurmadan, yeni bir Arşiv ünitesi aramadan) mevcut durumu döneriz.
  if (topic.is_archived && topic.frozen_unit_slug) {
    return NextResponse.json({ ok: true, topicId: topic.id, archiveUnitId: topic.unit_id, frozenUnitSlug: topic.frozen_unit_slug });
  }

  const { data: currentUnitRow, error: unitErr } = await supabase
    .from('units')
    .select('id, lesson_id, grade_id, slug, title')
    .eq('id', topic.unit_id)
    .maybeSingle();
  if (unitErr) return NextResponse.json({ ok: false, error: unitErr.message }, { status: 500 });
  const currentUnit = currentUnitRow as { id: number; lesson_id: number; grade_id: number; slug: string | null; title: string } | null;
  if (!currentUnit) return NextResponse.json({ ok: false, error: 'Konunun mevcut ünitesi bulunamadı' }, { status: 404 });

  // Konu, taşımadan ÖNCEKİ ünitenin slug'ını (varsa zaten dondurulmuş olanı KORUYARAK —
  // bir konu ikinci kez taşınırsa, ör. arşivden yanlışlıkla çıkarılıp tekrar arşivlenirse,
  // İLK dondurulan slug esas kalmalı, ikinci taşımanın kaynağı değil) frozen_unit_slug'a alır.
  const frozenUnitSlug = topic.frozen_unit_slug || currentUnit.slug || '';

  // (lesson_id, grade_id) başına TEK "Arşiv" ünitesi — find-or-create.
  const { data: existingArchiveUnit, error: findArchiveErr } = await supabase
    .from('units')
    .select('id')
    .eq('lesson_id', currentUnit.lesson_id)
    .eq('grade_id', currentUnit.grade_id)
    .eq('title', 'Arşiv')
    .maybeSingle();
  if (findArchiveErr) return NextResponse.json({ ok: false, error: findArchiveErr.message }, { status: 500 });

  let archiveUnitId: number;
  if (existingArchiveUnit) {
    archiveUnitId = (existingArchiveUnit as { id: number }).id;
  } else {
    const { data: maxOrderData } = await supabase
      .from('units')
      .select('order_no')
      .eq('lesson_id', currentUnit.lesson_id)
      .eq('grade_id', currentUnit.grade_id)
      .order('order_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxOrderData as { order_no: number } | null)?.order_no ?? 0) + 1;
    const { data: createdArchiveUnit, error: createErr } = await supabase
      .from('units')
      .insert({
        lesson_id: currentUnit.lesson_id,
        grade_id: currentUnit.grade_id,
        title: 'Arşiv',
        slug: 'arsiv',
        order_no: nextOrder,
        // Gerçek bir müfredat ünitesi değil — normal ünite listelerinde (ünite sayfası,
        // ana sayfa, soru bankası, quiz önerileri) hiç görünmemesi için kalıcı olarak
        // pasif kalır (bkz. saveTymmUnit'teki "yeni ünite is_active:false" konvansiyonu —
        // farkı: oradaki admin onayıyla aktifleşebilir, bu HİÇBİR ZAMAN aktifleşmemeli).
        is_active: false,
        description: 'Arşivlenmiş konular',
      })
      .select('id')
      .single();
    if (createErr || !createdArchiveUnit) {
      return NextResponse.json({ ok: false, error: createErr?.message || 'Arşiv ünitesi oluşturulamadı' }, { status: 500 });
    }
    archiveUnitId = (createdArchiveUnit as { id: number }).id;
  }

  // Konunun kendisi DIŞINDA hiçbir şeye dokunulmaz: title/slug/is_active aynen kalır,
  // outcomes/questions/topic_contents topic_id ile bağlı olduğu için unit_id değişiminden
  // hiç etkilenmez.
  const { error: updateErr } = await supabase
    .from('topics')
    .update({ unit_id: archiveUnitId, is_archived: true, frozen_unit_slug: frozenUnitSlug || null })
    .eq('id', topic.id);
  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, topicId: topic.id, archiveUnitId, frozenUnitSlug: frozenUnitSlug || null });
}
