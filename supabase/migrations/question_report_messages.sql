-- "Hatalı soru" bildirimleri için öğrenciyle yazışma (2026-10-25): admin her bildirime ayrı cevap yazar,
-- öğrenci Profil → Bildirdiğim sorular'da (/profil/bildirdigim-sorular) okur ve geri yazabilir. Her bildirimin (question_reports
-- satırı) yazışması bu tabloda. Admin yazması service role ile (app/api/admin/question-reports/reply),
-- öğrenci okuma/yazması aşağıdaki RPC'lerle — tabloda bilerek politika yok (question_reports.sql ile aynı desen).
-- Öğrenci mesaj sayısında sınır yok (kullanıcı kararı, ileride bakılacak); yalnız mesaj başına 500 karakter.
-- 2026-10-26: kapanış sonucu (resolution), öğrencinin listeden silmesi, okunmadı takibi. Kapanan bildirim
-- öğrencide "Tamamlanan" sekmesinde 30 gün ya da silene kadar durur; kapalı bildirime yazılamaz.
-- Dosyanın tamamı tekrar çalıştırılabilir.

create table if not exists public.question_report_messages (
  id bigint generated always as identity primary key,
  report_id bigint not null references public.question_reports(id) on delete cascade,
  sender text not null check (sender in ('admin', 'student')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists idx_question_report_messages_report on public.question_report_messages (report_id, created_at);
alter table public.question_report_messages enable row level security;

-- Öğrenci yazınca dolar, admin cevap yazınca boşalır — admin uyarı kutusu ve bildirim listesi bunu sayar.
alter table public.question_reports add column if not exists awaiting_admin_at timestamptz;
create index if not exists idx_question_reports_awaiting_admin on public.question_reports (awaiting_admin_at) where awaiting_admin_at is not null;

-- Admin kararı: fixed = düzeltildi, hidden = yayından kaldırıldı, no_error = hata yok (app/api/admin/question-reports POST).
alter table public.question_reports add column if not exists resolution text;
do $$ begin
  alter table public.question_reports add constraint question_reports_resolution_check check (resolution in ('fixed', 'hidden', 'no_error'));
exception when duplicate_object then null; end $$;
update public.question_reports set resolution = 'no_error' where status = 'dismissed' and resolution is null;
-- Eski 'resolved' kayıtlar: "Yayından kaldır" soruyu pasif yapar, "Düzelttim" yapmaz — sorunun durumundan çıkarılır.
update public.question_reports r set resolution = case when q.is_active then 'fixed' else 'hidden' end
from public.questions q where q.id = r.question_id and r.status = 'resolved' and r.resolution is null;
-- Öğrenci kapanmış bildirimi listesinden sildi (kayıt admin için kalır).
alter table public.question_reports add column if not exists student_hidden_at timestamptz;
-- Öğrencinin yazışmayı en son açtığı an — sonrasında gelen admin mesajı/kapanış "okunmadı" sayılır.
alter table public.question_reports add column if not exists student_seen_at timestamptz;
create index if not exists idx_question_reports_user on public.question_reports (user_id, created_at desc);

-- Bildirim kartı sorunun tamamını gösterir (okuma metni, görsel, şıklar, doğru şık, öğrencinin son işaretlediği şık)
-- ve soru bankasındaki ?soru=ID sayfasına link verir (soru yayında değilse link yok). fixed_total: öğrencinin
-- bildirimiyle düzeltilen/kaldırılan soru sayısı (silinmiş/süresi geçmişler dahil — teşekkür sayacı).
drop function if exists public.get_my_question_reports();
create function public.get_my_question_reports()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'fixed_total', (select count(*) from question_reports where user_id = auth.uid() and resolution in ('fixed', 'hidden')),
    'items', coalesce((
      select jsonb_agg(t order by t.last_activity desc)
      from (
        select
          r.id,
          r.question_id,
          q.question_text,
          q.svg_content,
          q.svg_position,
          qp.body as passage,
          l.name as lesson_name,
          tp.title as topic_title,
          r.reason,
          r.note,
          r.status,
          r.resolution,
          r.resolved_at,
          r.created_at,
          not q.is_active as question_hidden,
          case when q.is_active and g.slug is not null and l.slug is not null and u.slug is not null and tp.slug is not null
            then '/soru-bankasi/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || tp.slug || '?soru=' || q.id end as href,
          coalesce(
            (select jsonb_agg(jsonb_build_object('id', c.id, 'text', c.choice_text, 'is_correct', c.is_correct) order by c.id) from question_choices c where c.question_id = q.id),
            (select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text, 'is_correct', o.is_correct) order by o.id) from question_blank_options o where o.question_id = q.id),
            '[]'::jsonb
          ) as choices,
          (select a.selected_option_id from test_session_answers a where a.user_id = r.user_id and a.question_id = q.id order by a.created_at desc limit 1) as chosen_id,
          greatest(r.created_at, r.resolved_at, (select max(m.created_at) from question_report_messages m where m.report_id = r.id)) as last_activity,
          (
            exists (select 1 from question_report_messages m where m.report_id = r.id and m.sender = 'admin' and m.created_at > coalesce(r.student_seen_at, '-infinity'))
            or (r.status <> 'open' and r.resolved_at > coalesce(r.student_seen_at, '-infinity'))
          ) as unread,
          coalesce(
            (select jsonb_agg(jsonb_build_object('sender', m.sender, 'body', m.body, 'created_at', m.created_at) order by m.created_at) from question_report_messages m where m.report_id = r.id),
            '[]'::jsonb
          ) as messages
        from question_reports r
        join questions q on q.id = r.question_id
        left join question_passages qp on qp.id = q.passage_id
        left join topics tp on tp.id = q.topic_id
        left join units u on u.id = tp.unit_id
        left join lessons l on l.id = u.lesson_id
        left join grades g on g.id = u.grade_id
        where r.user_id = auth.uid()
          and r.student_hidden_at is null
          and (r.status = 'open' or coalesce(r.resolved_at, r.created_at) > now() - interval '30 days')
      ) t
    ), '[]'::jsonb)
  );
$$;

create or replace function public.reply_question_report(p_report_id bigint, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_user is null then raise exception 'Giriş gerekli' using errcode = '28000'; end if;
  if char_length(v_body) not between 1 and 500 then raise exception 'Mesaj 1-500 karakter olmalı' using errcode = '22023'; end if;
  update question_reports set awaiting_admin_at = now(), student_seen_at = now() where id = p_report_id and user_id = v_user and status = 'open';
  if not found then raise exception 'Bildirim bulunamadı ya da kapandı' using errcode = 'P0002'; end if;
  insert into question_report_messages (report_id, sender, body) values (p_report_id, 'student', v_body);
end;
$$;

create or replace function public.mark_question_report_seen(p_report_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update question_reports set student_seen_at = now() where id = p_report_id and user_id = auth.uid();
$$;

-- Yalnız kapanmış bildirim silinebilir (açık olan admin işini kaybettirmesin).
create or replace function public.hide_my_question_report(p_report_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update question_reports set student_hidden_at = now() where id = p_report_id and user_id = auth.uid() and status <> 'open';
  if not found then raise exception 'Bildirim bulunamadı ya da henüz kapanmadı' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.get_my_question_reports() from public, anon;
revoke all on function public.reply_question_report(bigint, text) from public, anon;
revoke all on function public.mark_question_report_seen(bigint) from public, anon;
revoke all on function public.hide_my_question_report(bigint) from public, anon;
grant execute on function public.get_my_question_reports() to authenticated;
grant execute on function public.reply_question_report(bigint, text) to authenticated;
grant execute on function public.mark_question_report_seen(bigint) to authenticated;
grant execute on function public.hide_my_question_report(bigint) to authenticated;
