-- "Hatalı soru bildir" (2026-10-12): AI soruları artık admin onayı olmadan yayınlandığı için
-- öğrencinin hatayı bildirebildiği son güvenlik ağı. Yalnız giriş yapmış öğrenci bildirir (spam).
-- Aynı soruyu 3 FARKLI öğrenci "cevap yanlış" diye bildirirse soru otomatik yayından kalkar
-- (auto_hidden) — admin "Soru doğru" deyince geri açılır. Admin ekranı: /admin/soru-bildirimleri.

create table if not exists public.question_reports (
  id bigserial primary key,
  question_id bigint not null references public.questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('wrong_answer', 'unclear', 'typo', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.question_reports enable row level security;
-- Politika yok: yazma report_question RPC'siyle, okuma admin API'siyle (service role).

-- Bir öğrencinin bir soru için tek açık bildirimi.
create unique index if not exists uq_question_reports_open_per_user on public.question_reports (question_id, user_id) where status = 'open';
create index if not exists idx_question_reports_open on public.question_reports (status, created_at desc);

-- Soru otomatik gizlendiyse işaret (admin bunu görür; "Soru doğru" → geri açılır).
alter table public.questions add column if not exists auto_hidden_at timestamptz;

create or replace function public.report_question(p_question_id bigint, p_reason text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_wrong int;
  v_hidden boolean := false;
begin
  if v_user is null then raise exception 'Giriş gerekli' using errcode = '28000'; end if;
  if p_reason not in ('wrong_answer', 'unclear', 'typo', 'other') then raise exception 'Geçersiz neden' using errcode = '22P02'; end if;
  if not exists (select 1 from questions where id = p_question_id and is_active) then
    raise exception 'Soru bulunamadı' using errcode = 'P0002';
  end if;
  -- Kötüye kullanım sınırı: kişi başı günde 20 bildirim.
  if (select count(*) from question_reports where user_id = v_user and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Bugün çok fazla bildirim gönderdin' using errcode = '54000';
  end if;

  insert into question_reports (question_id, user_id, reason, note)
  values (p_question_id, v_user, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  on conflict (question_id, user_id) where status = 'open' do nothing;

  select count(distinct user_id) into v_wrong
  from question_reports where question_id = p_question_id and status = 'open' and reason = 'wrong_answer';
  if v_wrong >= 3 then
    update questions set is_active = false, auto_hidden_at = now() where id = p_question_id and is_active;
    v_hidden := found;
  end if;

  return jsonb_build_object('ok', true, 'hidden', v_hidden);
end;
$$;

revoke all on function public.report_question(bigint, text, text) from public, anon;
grant execute on function public.report_question(bigint, text, text) to authenticated;
