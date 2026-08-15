import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import {
  listMebLessons,
  resolveMebGradeUrl,
  listMebUnitsForGradePage,
  scrapeMebUnit,
  buildUnitImportPayload,
  type UnitImportPayload,
} from '@/app/src/lib/mebScraper';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const lessons = await listMebLessons();
    return NextResponse.json({ lessons });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'MEB dersleri alınamadı' }, { status: 502 });
  }
}

type ScanRow = {
  title: string;
  sourceUrl: string;
  durationHours: number | null;
  topicCount: number;
  outcomeCount: number;
  status: 'ready' | 'needs_review' | 'duplicate';
  payload?: UnitImportPayload;
};

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { mebDersSlug?: unknown; lessonId?: unknown; gradeId?: unknown; gradeNumber?: unknown }
    | null;

  const mebDersSlug = typeof body?.mebDersSlug === 'string' ? body.mebDersSlug : '';
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);
  const gradeNumber = Number(body?.gradeNumber);

  if (!mebDersSlug || !Number.isFinite(lessonId) || !Number.isFinite(gradeId) || !Number.isFinite(gradeNumber)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  let gradePage: { segment: string; path: string } | null;
  try {
    gradePage = await resolveMebGradeUrl(mebDersSlug, gradeNumber);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'MEB sınıf sayfası çözülemedi' }, { status: 502 });
  }
  if (!gradePage) {
    return NextResponse.json(
      { error: `MEB'de "${mebDersSlug}" dersi için ${gradeNumber}. sınıf sayfası bulunamadı` },
      { status: 404 }
    );
  }

  let unitLinks: { id: string; path: string }[];
  try {
    unitLinks = await listMebUnitsForGradePage(mebDersSlug, gradePage.path);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ünite listesi alınamadı' }, { status: 502 });
  }

  const supabase = createServiceClient();

  const rows: ScanRow[] = await Promise.all(
    unitLinks.map(async (link): Promise<ScanRow> => {
      const scraped = await scrapeMebUnit(mebDersSlug, link.path);
      const built = buildUnitImportPayload(scraped);

      if (built.status === 'needs_review') {
        return {
          title: scraped.title,
          sourceUrl: scraped.sourceUrl,
          durationHours: scraped.durationHours,
          topicCount: scraped.topics.length,
          outcomeCount: scraped.outcomes.length,
          status: 'needs_review',
        };
      }

      const { data: existing } = await supabase
        .from('units')
        .select('id')
        .eq('lesson_id', lessonId)
        .eq('grade_id', gradeId)
        .eq('title', built.payload.title)
        .limit(1);

      return {
        title: built.payload.title,
        sourceUrl: scraped.sourceUrl,
        durationHours: built.payload.duration_hours,
        topicCount: built.payload.topics.length,
        outcomeCount: scraped.outcomes.length,
        status: existing && existing.length ? 'duplicate' : 'ready',
        payload: existing && existing.length ? undefined : built.payload,
      };
    })
  );

  return NextResponse.json({ units: rows });
}
