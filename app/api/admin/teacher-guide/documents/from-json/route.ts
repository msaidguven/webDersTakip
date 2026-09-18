import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseTeacherGuideJson } from '@/app/src/lib/teacherGuide/structureTeacherGuide';
import { saveTeacherGuideNotes } from '@/app/src/lib/teacherGuide/processTeacherGuideDocument';

// 50MB Storage limitini aşan kılavuz kitaplar için: admin, lesson-prompt'un ürettiği promptu
// NotebookLM'e (kaynak olarak kılavuz PDF'ini yüklediği notebook'ta) sorar, NotebookLM zaten
// JSON döndürdüğü için (structureTeacherGuideUnitText'in ürettiğiyle AYNI şema) burada ekstra
// bir Gemini çağrısı yok — sadece ayrıştırıp kaydediyoruz. Ünite bazlı değil DERS bazlı: kılavuz
// kitaplar kısa olduğundan tüm ünitelerin JSON'u tek seferde geliyor (kullanıcının 2026-09-18
// isteği — "dersin tamamını bir defada yükleyemez miyiz").
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as
    | { gradeId?: unknown; lessonId?: unknown; json?: unknown }
    | null;
  const gradeId = Number(body?.gradeId);
  const lessonId = Number(body?.lessonId);
  const rawJson = typeof body?.json === 'string' ? body.json.trim() : '';

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }
  if (!rawJson) return NextResponse.json({ error: 'Yapıştırılan metin boş olamaz' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: lessonGrade } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!lessonGrade) return NextResponse.json({ error: 'Bu sınıf/ders kombinasyonu bulunamadı' }, { status: 404 });

  const [{ data: lesson }, { data: unitsData }] = await Promise.all([
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
    supabase.from('units').select('id').eq('grade_id', gradeId).eq('lesson_id', lessonId).eq('is_active', true),
  ]);
  const unitIds = ((unitsData as { id: number }[] | null) || []).map((u) => u.id);
  if (!unitIds.length) return NextResponse.json({ error: 'Bu sınıf/derste aktif ünite yok' }, { status: 400 });

  const { data: topicsData } = await supabase.from('topics').select('id, title').in('unit_id', unitIds).eq('is_active', true);
  const topics = (topicsData as { id: number; title: string }[] | null) || [];
  if (!topics.length) return NextResponse.json({ error: 'Bu ünitelerde aktif konu yok' }, { status: 400 });

  let notes;
  try {
    notes = parseTeacherGuideJson(rawJson, topics);
  } catch (err) {
    return NextResponse.json({ error: `JSON ayrıştırılamadı: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }
  if (!notes.length) {
    return NextResponse.json({ error: 'JSON içinde bu derse ait geçerli bir konu bulunamadı' }, { status: 400 });
  }

  const { data: document, error: insertError } = await supabase
    .from('teacher_guide_documents')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      title: (lesson as { name: string } | null)?.name || 'Öğretmen Kılavuzu',
      source: 'notebooklm_json',
      status: 'ready',
      topic_count: notes.length,
      uploaded_by: admin.user.id,
    })
    .select('id')
    .single();
  if (insertError || !document) {
    return NextResponse.json({ error: insertError?.message || 'Belge kaydedilemedi' }, { status: 500 });
  }

  try {
    await saveTeacherGuideNotes(supabase, document.id, notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('teacher_guide_documents').update({ status: 'failed', error_message: message }).eq('id', document.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ id: document.id, savedTopicCount: notes.length });
}
