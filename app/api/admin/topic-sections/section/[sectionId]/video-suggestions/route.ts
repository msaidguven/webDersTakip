import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  sectionId: string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('topic_section_video_suggestions')
    .select('id, video_url, video_title, note, ai_model, created_at')
    .eq('section_id', sectionId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Öneriler yüklenemedi' }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data || [] });
}

// Farklı AI'lardan gelen önerileri BİRİKTİRİYORUZ — her POST sadece yeni bir satır EKLER,
// var olan önerileri asla silmez/üzerine yazmaz (kullanıcının 2026-09-16 isteği: "önceki
// önerileri silmeyecek, yeni öneriler ekleyecek"). Admin listeyi inceleyip birini onaylıyor.
export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null) as {
    video_url?: unknown;
    video_title?: unknown;
    note?: unknown;
    ai_model?: unknown;
  } | null;

  const videoUrl = typeof body?.video_url === 'string' ? body.video_url.trim() : '';
  if (!videoUrl) {
    return NextResponse.json({ error: 'video_url gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('topic_section_video_suggestions')
    .insert({
      section_id: Number(sectionId),
      video_url: videoUrl,
      video_title: typeof body?.video_title === 'string' && body.video_title.trim() ? body.video_title.trim() : null,
      note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null,
      ai_model: typeof body?.ai_model === 'string' && body.ai_model.trim() ? body.ai_model.trim() : null,
    })
    .select('id, video_url, video_title, note, ai_model, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({ suggestion: data });
}
