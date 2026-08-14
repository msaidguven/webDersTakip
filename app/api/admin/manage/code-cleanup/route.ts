import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseCurriculumCodeFromTitle } from '@/app/src/lib/curriculumCodeParser';

type EntityType = 'unit' | 'topic';
type Candidate = { id: number; entityType: EntityType; currentTitle: string; code: string; cleanTitle: string };

// Başlığında gömülü müfredat kodu olup curriculum_code'u hâlâ boş olan
// ünite/konuları tarar; admin panelindeki Kod Temizliği ekranı için önizleme üretir.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const candidates: Candidate[] = [];

  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, title, curriculum_code')
    .is('curriculum_code', null);
  if (topicsError) return NextResponse.json({ error: `Konular okunamadı: ${topicsError.message}` }, { status: 500 });

  for (const t of (topics as { id: number; title: string }[]) || []) {
    const parsed = parseCurriculumCodeFromTitle(t.title);
    if (parsed) candidates.push({ id: t.id, entityType: 'topic', currentTitle: t.title, code: parsed.code, cleanTitle: parsed.cleanTitle });
  }

  let unitsAvailable = true;
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, title, curriculum_code')
    .is('curriculum_code', null);

  if (unitsError) {
    // units.curriculum_code sütunu henüz eklenmemiş olabilir (bkz. supabase/units_curriculum_code.sql)
    unitsAvailable = false;
  } else {
    for (const u of (units as { id: number; title: string }[]) || []) {
      const parsed = parseCurriculumCodeFromTitle(u.title);
      if (parsed) candidates.push({ id: u.id, entityType: 'unit', currentTitle: u.title, code: parsed.code, cleanTitle: parsed.cleanTitle });
    }
  }

  return NextResponse.json({ candidates, unitsAvailable });
}

type ApplyItem = { id: number; entityType: EntityType; code: string; title: string };

// Seçilen satırları uygular: curriculum_code'u yazar, başlığı temizler.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? (body.items as ApplyItem[]) : [];
  if (!items.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const applied: number[] = [];
  const failed: { id: number; reason: string }[] = [];

  for (const item of items) {
    if (!item || typeof item.id !== 'number' || (item.entityType !== 'unit' && item.entityType !== 'topic')) continue;
    const table = item.entityType === 'unit' ? 'units' : 'topics';
    const { error } = await supabase.from(table).update({ curriculum_code: item.code, title: item.title }).eq('id', item.id);
    if (error) failed.push({ id: item.id, reason: error.message });
    else applied.push(item.id);
  }

  return NextResponse.json({ applied, failed });
}
