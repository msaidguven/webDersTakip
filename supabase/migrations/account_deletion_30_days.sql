-- Hesap silme (2026-11-15): üye /hesap-silme sayfasından silme isteği verir; hesap HEMEN silinmez,
-- 30 gün sonra kalıcı olarak silinir. Bu sürede giriş yapıp vazgeçebilir.
-- Süre kodda da tanımlı: app/src/lib/accountDeletion.ts (ACCOUNT_DELETION_GRACE_DAYS) — ikisi aynı kalmalı.
-- SIRA: önce bu dosyayı çalıştırın, sonra kodu deploy edin (kod deletion_requested_at sütununu okur).

-- 1) Silme isteği zamanı. null = istek yok.
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

-- 2) Silmeyi engelleyen bağlar. Bu tablolarda "on delete" tanımlı değildi; bildirimi, konu ilerlemesi
--    ya da yorumu olan bir üye hiç silinemiyordu (admin panelindeki "kalıcı sil" de hata veriyordu).
--    Üyenin kendi kayıtları onunla birlikte silinir; yapay zekâ cevabı ve bildirimi sahipsiz kalır.
--    Yalnız adminlerin doldurduğu denetim sütunları (reviewed_by, uploaded_by, resolved_by…) bilerek
--    değiştirilmedi: admin hesabı bu akışla silinemez.
alter table public.notifications
  drop constraint notifications_user_id_fkey,
  add constraint notifications_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.user_topic_content_progress
  drop constraint fk_utcp_user,
  add constraint fk_utcp_user foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.question_comments
  drop constraint question_comments_student_id_fkey,
  add constraint question_comments_student_id_fkey foreign key (student_id) references public.profiles(id) on delete cascade;

-- Silinen yorumun altındaki cevaplar zaten birlikte siliniyor (parent_comment_id cascade);
-- o yorum için kuyrukta bekleyen yapay zekâ işi de aynı şekilde gider.
alter table public.rag_question_queue
  drop constraint rag_question_queue_student_id_fkey,
  drop constraint rag_question_queue_comment_id_fkey,
  drop constraint rag_question_queue_parent_comment_id_fkey,
  add constraint rag_question_queue_student_id_fkey foreign key (student_id) references public.profiles(id) on delete cascade,
  add constraint rag_question_queue_comment_id_fkey foreign key (comment_id) references public.question_comments(id) on delete cascade,
  add constraint rag_question_queue_parent_comment_id_fkey foreign key (parent_comment_id) references public.question_comments(id) on delete cascade;

alter table public.rag_answers
  drop constraint rag_answers_student_id_fkey,
  add constraint rag_answers_student_id_fkey foreign key (student_id) references public.profiles(id) on delete set null;

alter table public.rag_answer_reports
  drop constraint rag_answer_reports_student_id_fkey,
  add constraint rag_answer_reports_student_id_fkey foreign key (student_id) references public.profiles(id) on delete set null;

-- 3) Süresi dolan hesapları silen iş: her gün 03:45 TR (00:45 UTC). Dosyalar (profil fotoğrafı, yazılı
--    cevap fotoğrafları) Storage API ile silinmek zorunda olduğu için silme /api/cron/hesap-silme'de yapılır.
--    Süresi dolan hesap yoksa istek hiç atılmaz (Vercel fonksiyonu çalışmaz).
--    Yetki: diğer işlerle aynı vault sırrı (rag_queue_worker_secret).
select cron.unschedule('hesap-silme')
where exists (select 1 from cron.job where jobname = 'hesap-silme');

select cron.schedule(
  'hesap-silme',
  '45 0 * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/cron/hesap-silme',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (
    select 1 from public.profiles
    where deletion_requested_at < now() - interval '30 days'
  );
  $$
);
