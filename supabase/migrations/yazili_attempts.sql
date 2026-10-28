-- Öğrenci yazılı denemeleri (2026-10-26): "Yeni yazılı aç" — rastgele senaryo + rastgele soru, öğrenci cevaplarını
-- yazar, yapay zekâ puanlar. Cevaplar kalıcı saklanır. Günde en fazla 3 yazılı açılır (TR saatine göre gün);
-- açık (puanlanmamış) deneme varsa yenisi açılmaz, mevcut olan döner — yarım kalan hak yakmaz.
--   in_progress: açıldı, cevaplar gönderilmedi
--   submitted:   cevaplar kaydedildi, puanlama başarısız/bekliyor (yeniden denenebilir, ek hak harcamaz)
--   graded:      puanlandı
-- Yazma yalnız sunucu route'larından (service role); öğrenci kendi satırlarını okuyabilir.
create table if not exists public.yazili_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  scenario_no smallint,
  variant smallint,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  total_score numeric(5, 1),
  grading_model text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz
);
create index if not exists yazili_attempts_user_created_idx on public.yazili_attempts (user_id, created_at desc);
create index if not exists yazili_attempts_exam_idx on public.yazili_attempts (exam_id);

create table if not exists public.yazili_attempt_answers (
  attempt_id bigint not null references public.yazili_attempts(id) on delete cascade,
  question_id bigint not null references public.questions(id) on delete cascade,
  position smallint not null,
  points smallint not null check (points > 0),
  answer_text text,
  score numeric(5, 1),
  feedback text,
  primary key (attempt_id, question_id)
);

alter table public.yazili_attempts enable row level security;
alter table public.yazili_attempt_answers enable row level security;

drop policy if exists yazili_attempts_own_read on public.yazili_attempts;
create policy yazili_attempts_own_read on public.yazili_attempts for select to authenticated using (user_id = auth.uid());

drop policy if exists yazili_attempt_answers_own_read on public.yazili_attempt_answers;
create policy yazili_attempt_answers_own_read on public.yazili_attempt_answers for select to authenticated
  using (exists (select 1 from public.yazili_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

revoke all on public.yazili_attempts, public.yazili_attempt_answers from anon, authenticated;
grant select on public.yazili_attempts, public.yazili_attempt_answers to authenticated;

-- Deneme açar. p_items: [{"question_id": 1, "points": 10}, ...] sıralı. Sonuç: attempt_id, created (yeni mi),
-- used_today (bugün açılan, bu dahil), limit_reached (hak bitti → deneme açılmadı).
-- Kullanıcı başına advisory kilit: aynı anda iki istek limiti aşamaz.
create or replace function public.start_yazili_attempt(
  p_user_id uuid,
  p_exam_id bigint,
  p_scenario smallint,
  p_variant smallint,
  p_items jsonb,
  p_daily_limit int default 3
)
returns table (attempt_id bigint, created boolean, used_today int, limit_reached boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open bigint;
  v_used int;
  v_new bigint;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
begin
  perform pg_advisory_xact_lock(hashtextextended('yazili_attempt:' || p_user_id::text, 0));

  select count(*) into v_used from public.yazili_attempts where user_id = p_user_id and created_at >= v_day_start;

  select a.id into v_open from public.yazili_attempts a
    where a.user_id = p_user_id and a.exam_id = p_exam_id and a.status <> 'graded'
    order by a.created_at desc limit 1;
  if v_open is not null then
    return query select v_open, false, v_used, false;
    return;
  end if;

  if v_used >= p_daily_limit then
    return query select null::bigint, false, v_used, true;
    return;
  end if;

  insert into public.yazili_attempts (user_id, exam_id, scenario_no, variant)
    values (p_user_id, p_exam_id, p_scenario, p_variant) returning id into v_new;
  insert into public.yazili_attempt_answers (attempt_id, question_id, position, points)
    select v_new, (i.item ->> 'question_id')::bigint, (i.ord - 1)::smallint, (i.item ->> 'points')::smallint
    from jsonb_array_elements(p_items) with ordinality as i(item, ord);

  return query select v_new, true, v_used + 1, false;
end;
$$;

revoke all on function public.start_yazili_attempt(uuid, bigint, smallint, smallint, jsonb, int) from public, anon, authenticated;
grant execute on function public.start_yazili_attempt(uuid, bigint, smallint, smallint, jsonb, int) to service_role;
