import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getYaziliExam } from '@/app/src/lib/yazili/publicData';
import { gradeAnswers, isGradingConfigured, MAX_ANSWER_LENGTH } from '@/app/src/lib/yazili/aiGrading';
import { buildAttemptView, loadAttemptRow, YAZILI_IMAGE_BUCKET } from '@/app/src/lib/yazili/attempts';

// Yazılı denemesini puanlar: cevaplar ÖNCE kaydedilir, sonra yapay zekâ puanlar. Puanlama başarısız olursa
// cevaplar durur (status='submitted'), öğrenci aynı düğmeyle yeniden dener — ek yazılı hakkı harcanmaz.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const attemptId = Number((await params).id);
  const body = (await request.json().catch(() => null)) as { sinif?: unknown; ders?: unknown; yazili?: unknown; answers?: unknown } | null;
  if (!Number.isInteger(attemptId) || typeof body?.sinif !== 'string' || typeof body.ders !== 'string' || typeof body.yazili !== 'string') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const loaded = await loadAttemptRow(attemptId);
  if (!loaded || loaded.attempt.user_id !== user.id) return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });
  const data = await getYaziliExam(body.sinif, body.ders, body.yazili);
  if (!data || data.exam.id !== loaded.attempt.exam_id) return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });

  // Zaten puanlanmışsa saklı sonucu döndür (çift tık / yenileme yeniden AI çağrısı yapmasın).
  if (loaded.attempt.status === 'graded') return NextResponse.json({ attempt: await buildAttemptView(loaded.attempt, loaded.answers, data) });

  const supabase = createServiceClient();

  // 1) Cevapları kaydet (yalnız bu denemenin soruları; fazlası yok sayılır).
  const sent = new Map<number, string>();
  if (Array.isArray(body.answers)) {
    for (const a of body.answers as { questionId?: unknown; text?: unknown }[]) {
      if (typeof a?.questionId === 'number' && typeof a.text === 'string') sent.set(a.questionId, a.text.slice(0, MAX_ANSWER_LENGTH));
    }
  }
  const answers = loaded.answers.map((a) => ({ ...a, answer_text: sent.get(a.question_id) ?? a.answer_text ?? '' }));
  if (!answers.some((a) => a.answer_text.trim() || a.answer_image_path)) return NextResponse.json({ error: 'En az bir soruyu cevaplamalısın.' }, { status: 400 });

  const { error: saveError } = await supabase
    .from('yazili_attempt_answers')
    .upsert(answers.map((a) => ({ attempt_id: attemptId, question_id: a.question_id, position: a.position, points: a.points, answer_text: a.answer_text })));
  if (saveError) {
    console.error('[yazili/deneme] cevaplar kaydedilemedi:', saveError.message);
    return NextResponse.json({ error: 'Cevapların kaydedilemedi, tekrar dene.' }, { status: 500 });
  }
  await supabase.from('yazili_attempts').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', attemptId);

  if (!isGradingConfigured()) {
    return NextResponse.json({ error: 'Cevapların kaydedildi, ama yapay zekâ kontrolü şu an kapalı. Daha sonra tekrar dene.' }, { status: 503 });
  }

  // 2) Yapay zekâ ile puanla.
  const byId = new Map(data.topics.flatMap((t) => t.questions).map((q) => [q.id, q]));
  try {
    const inputs = await Promise.all(answers.map(async (a) => {
      const q = byId.get(a.question_id);
      if (!q) return null;
      let image: { mimeType: string; data: string } | null = null;
      if (a.answer_image_path) {
        const { data: blob } = await supabase.storage.from(YAZILI_IMAGE_BUCKET).download(a.answer_image_path);
        if (blob) image = { mimeType: 'image/jpeg', data: Buffer.from(await blob.arrayBuffer()).toString('base64') };
      }
      return { questionId: q.id, points: a.points, question: q.text, modelAnswer: q.modelAnswer, keyTerms: q.keyTerms, rubric: q.rubric, answer: a.answer_text, questionSvg: q.svgContent, answerSvg: q.answerSvgContent, answerImage: image };
    }));
    const { results, model } = await gradeAnswers(inputs.filter((i): i is NonNullable<typeof i> => i !== null));
    const total = results.reduce((sum, r) => sum + r.score, 0);
    await Promise.all(results.map((r) =>
      supabase.from('yazili_attempt_answers').update({ score: r.score, feedback: r.feedback }).eq('attempt_id', attemptId).eq('question_id', r.questionId)
    ));
    await supabase.from('yazili_attempts')
      .update({ status: 'graded', total_score: total, grading_model: model, graded_at: new Date().toISOString() }).eq('id', attemptId);
  } catch (e) {
    console.error('[yazili/deneme] puanlama başarısız:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Cevapların kaydedildi ama kontrol edilemedi. Biraz sonra tekrar dene.' }, { status: 502 });
  }

  const fresh = await loadAttemptRow(attemptId);
  return NextResponse.json({ attempt: fresh ? await buildAttemptView(fresh.attempt, fresh.answers, data) : null });
}

// Geçmiş yazılı: yalnız kendi PUANLANMIŞ denemesi (açık deneme ana GET'ten gelir, cevap anahtarı sızmasın).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const attemptId = Number((await params).id);
  const sp = request.nextUrl.searchParams;
  const [sinif, ders, yazili] = [sp.get('sinif'), sp.get('ders'), sp.get('yazili')];
  if (!Number.isInteger(attemptId) || !sinif || !ders || !yazili) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const loaded = await loadAttemptRow(attemptId);
  if (!loaded || loaded.attempt.user_id !== user.id || loaded.attempt.status !== 'graded') return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });
  const data = await getYaziliExam(sinif, ders, yazili);
  if (!data || data.exam.id !== loaded.attempt.exam_id) return NextResponse.json({ error: 'Yazılı bulunamadı' }, { status: 404 });
  return NextResponse.json({ attempt: await buildAttemptView(loaded.attempt, loaded.answers, data) });
}
