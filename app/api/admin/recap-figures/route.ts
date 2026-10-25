import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { isRecapFigureSvg, normalizeRecapCard } from '@/app/src/lib/recapCards';
import { slugifyHeading } from '@/app/src/lib/site';
import { revalidateTopicPagesBySectionIds } from '@/app/src/lib/topicPageRevalidation';

// Hap bilgi örneklerinin şekilleri (/admin/svg-sorulari?tur=kart): model yalnız tarif yazar (example.figure_prompt),
// admin promptu kopyalayıp başka bir AI'ya çizdirir ve SVG'yi buraya kaydeder. Aynı işi Claude
// scripts/recap-figures.ts ile yapar. Çizilene kadar örnek sayfada gizli.

type Embed<T> = T | T[] | null;
const one = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

type Row = {
  id: number;
  heading: string;
  recap_card: unknown;
  topic_contents: Embed<{
    topics: Embed<{ title: string; slug: string | null; units: Embed<{ slug: string | null; grades: Embed<{ slug: string | null }>; lessons: Embed<{ slug: string | null }> }> }>;
  }>;
};

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const status = request.nextUrl.searchParams.get('status') || 'pending';
  const supabase = createServiceClient();
  const base = supabase
    .from('topic_content_sections')
    .select('id, heading, recap_card, topic_contents!inner(topics!inner(title, slug, units(slug, grades(slug), lessons(slug))))')
    .not('recap_card->example->>figure_prompt', 'is', null)
    .order('id', { ascending: false })
    .limit(200);
  const { data, error } =
    status === 'pending'
      ? await base.is('recap_card->example->>figure_svg', null)
      : status === 'done'
        ? await base.not('recap_card->example->>figure_svg', 'is', null)
        : await base;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data as unknown as Row[] | null) || []).flatMap((row) => {
    const example = normalizeRecapCard(row.recap_card)?.example;
    if (!example?.figure_prompt) return [];
    const topic = one(one(row.topic_contents)?.topics ?? null);
    const unit = one(topic?.units ?? null);
    const grade = one(unit?.grades ?? null);
    const lesson = one(unit?.lessons ?? null);
    const href =
      topic?.slug && unit?.slug && grade?.slug && lesson?.slug ? `/${grade.slug}/${lesson.slug}/${unit.slug}/${topic.slug}#${slugifyHeading(row.heading)}` : null;
    return [
      {
        id: row.id,
        heading: row.heading,
        topicTitle: topic?.title ?? null,
        question: example.question,
        solution: example.solution,
        figure_prompt: example.figure_prompt,
        figure_svg: example.figure_svg,
        href,
      },
    ];
  });
  return NextResponse.json({ items });
}

// { sectionId, svg }: şekli kaydeder (null → siler, örnek yeniden gizlenir).
// { sectionId, dropFigure: true }: şekil gereksiz — tarif kaldırılır, örnek şekilsiz yayınlanır.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { sectionId?: unknown; svg?: unknown; dropFigure?: unknown } | null;
  const sectionId = Number(body?.sectionId);
  if (!Number.isInteger(sectionId) || sectionId <= 0) return NextResponse.json({ error: 'Geçersiz bölüm' }, { status: 400 });
  const dropFigure = body?.dropFigure === true;
  const svg = typeof body?.svg === 'string' && body.svg.trim() ? body.svg.trim() : null;
  if (!dropFigure && svg && !isRecapFigureSvg(svg)) {
    return NextResponse.json({ error: 'Geçersiz SVG (<svg …</svg>, en fazla 20.000 karakter)' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.from('topic_content_sections').select('recap_card').eq('id', sectionId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const card = normalizeRecapCard(data?.recap_card);
  if (!card?.example?.figure_prompt) return NextResponse.json({ error: 'Bu bölümün kartında şekil isteyen örnek yok' }, { status: 404 });

  const example = dropFigure ? { ...card.example, figure_prompt: null, figure_svg: null } : { ...card.example, figure_svg: svg };
  const { error: updateError } = await supabase.from('topic_content_sections').update({ recap_card: { ...card, example } }).eq('id', sectionId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Tek sayfa, admin eylemi — haftalık önbellek yenilemesini beklemesin.
  await revalidateTopicPagesBySectionIds(supabase, [sectionId]);
  return NextResponse.json({ ok: true });
}
