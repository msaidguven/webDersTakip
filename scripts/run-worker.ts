// Zamanlanmış worker'ı Vercel DIŞINDA çalıştırır (GitHub Actions: .github/workflows/worker.yml; tetikleyen
// Supabase pg_cron, bkz. supabase/migrations/workers_to_github_actions.sql). Gövde Vercel rotalarıyla aynı
// (app/src/lib/workerRuns.ts) — yalnız işlemci süresi Vercel'in aktif CPU sınırından düşmez.
//
//   NODE_OPTIONS=--conditions=react-server npx tsx scripts/run-worker.ts <question|content|narration> [worker] [task]
//   örn. ... run-worker.ts question secondary interactive_lesson
// Yerelde .env.local okunur; CI'da değişkenler ortamdan gelir. Çıktı herkese açık Actions kaydına düşer:
// yalnız sonuç özeti yazdırılır.
import { existsSync, readFileSync } from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
}
// Next sunucusu yok: sayfa önbelleği sitedeki uçtan düşürülür (bkz. app/src/lib/cacheInvalidation.ts).
process.env.WORKER_REVALIDATE_URL ||= 'https://www.derstakip.net/api/internal/revalidate';

async function main(): Promise<number> {
  const [kind, worker = '', task = ''] = process.argv.slice(2);
  const { createClient } = await import('@supabase/supabase-js');
  const { isQuestionWorkerId } = await import('../app/src/lib/questionWorkerProfiles');
  const { isContentWorkerId, runContentWorker, runNarrationWorker, runQuestionWorker } = await import('../app/src/lib/workerRuns');
  const { flushRemoteRevalidation } = await import('../app/src/lib/cacheInvalidation');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY tanımlı değil');
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  let failed = false;
  let summary: Record<string, unknown>;
  if (kind === 'question') {
    if (worker && !isQuestionWorkerId(worker)) throw new Error(`Geçersiz soru worker'ı: ${worker}`);
    const r = await runQuestionWorker(supabase, worker && isQuestionWorkerId(worker) ? worker : undefined, task || undefined);
    summary = { generated: r.generated, reason: r.reason ?? null };
  } else if (kind === 'content') {
    if (worker && !isContentWorkerId(worker)) throw new Error(`Geçersiz içerik worker'ı: ${worker}`);
    const r = await runContentWorker(supabase, worker && isContentWorkerId(worker) ? worker : undefined);
    summary = { generated: r.generated, reason: r.reason ?? null, ...('recap' in r ? { recap: { ok: r.recap.ok, topicId: r.recap.topicId ?? null, reason: r.recap.reason ?? null } } : {}) };
  } else if (kind === 'narration') {
    const r = await runNarrationWorker(supabase);
    failed = r.status >= 500;
    const { topicId, outcome, completed, made, reused, error } = r.body;
    summary = { topicId, outcome, completed, made, reused, error };
  } else {
    throw new Error('Kullanım: run-worker.ts <question|content|narration> [worker] [task]');
  }

  const revalidation = await flushRemoteRevalidation();
  if (revalidation.error) console.error(`Önbellek yenileme isteği ulaşmadı: ${revalidation.error}`);
  console.log(JSON.stringify({ kind, worker: worker || 'primary', ...(task ? { task } : {}), ...summary, revalidated: revalidation.sent }));
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
