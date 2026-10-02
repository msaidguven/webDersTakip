import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { createAzureEngine } from '@/app/src/lib/narration/azureTts';
import { generateTopicNarration } from '@/app/src/lib/narration/generateTopicNarration';
import { revalidateTopicPage } from '@/app/src/lib/topicPageRevalidation';

// "Video / Sesli Anlatım" worker'ı — Supabase pg_cron saatte bir tetikler (bkz.
// supabase/migrations/topic_narrations.sql). Her çağrıda kuyruktaki ilk konuyu (anlatımı olmayan
// ya da içeriği değişmiş) seslendirir. Azure ücretsiz katmanı dakikada ~20 istek → ~50 cümlelik
// bir konu ~3-4 dk sürer; süre bütçesi dolarsa konu yarıda bırakılır, sonraki çağrı üretilmiş
// sesleri önbellekten alıp devam eder. Çağrının çoğu TTS yanıtı beklemek (aktif CPU'ya sayılmaz),
// MP3 Azure'dan hazır geldiği için kodlama yok.
export const maxDuration = 300;
const WORK_BUDGET_MS = 230_000;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const started = Date.now();
  const supabase = createServiceClient();
  // net.http_post yanıtı beklemediği için sonuç burada loglanır (topic_narration_worker_runs).
  const logRun = (row: { topic_id: number | null; outcome: string; screens_made?: number; screens_reused?: number; reason?: string | null }) =>
    supabase.from('topic_narration_worker_runs').insert(row);

  const { data: next, error: nextErr } = await supabase.rpc('next_topic_for_narration');
  if (nextErr) {
    await logRun({ topic_id: null, outcome: 'failed', reason: `kuyruk: ${nextErr.message}` });
    return NextResponse.json({ error: nextErr.message }, { status: 500 });
  }
  const topicId = (next as { topic_id: number }[] | null)?.[0]?.topic_id;
  if (!topicId) {
    await logRun({ topic_id: null, outcome: 'idle' });
    return NextResponse.json({ outcome: 'idle' });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    await logRun({ topic_id: topicId, outcome: 'failed', reason: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION tanımlı değil' });
    return NextResponse.json({ error: 'Azure yapılandırılmamış' }, { status: 500 });
  }

  try {
    const engine = await createAzureEngine(key, region);
    const result = await generateTopicNarration(supabase, topicId, engine, { deadline: started + WORK_BUDGET_MS });
    if (result.completed) await revalidateTopicPage(supabase, topicId);
    await logRun({
      topic_id: topicId,
      outcome: result.completed ? 'completed' : 'partial',
      screens_made: result.made,
      screens_reused: result.reused,
      reason: result.completed ? `${engine.voice} · ${result.screenCount} ekran · ${Math.round((result.durationSeconds ?? 0) / 60)} dk` : 'süre doldu, sonraki çalıştırmada devam',
    });
    return NextResponse.json({ topicId, ...result });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await logRun({ topic_id: topicId, outcome: 'failed', reason: reason.slice(0, 500) });
    return NextResponse.json({ topicId, error: reason }, { status: 500 });
  }
}
