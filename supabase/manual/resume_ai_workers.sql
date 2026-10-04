-- 2026-10-04: Vercel Fluid Active CPU sınırı aşıldığı için yapay zekâ worker'ları GEÇİCİ olarak
-- durduruldu (cron.alter_job active := false; hiçbir job/kod silinmedi). O an AKTİF olan beş job
-- bunlardı — yeniden açmak için bu dosyayı Supabase SQL Editor'da çalıştır.
-- (ai-content-draft-worker-2, ai-topic-highlights-worker, rag-queue-worker zaten öncesinde pasifti;
--  onları açma.)
select cron.alter_job(jobid, active := true)
from cron.job
where jobname in (
  'ai-content-draft-worker',
  'ai-question-draft-worker',
  'ai-question-draft-worker-2',
  'ai-question-draft-worker-3',
  'topic-narration-worker'
);
