-- Günün Sorusu istatistiği ("öğrencilerin %X'i doğru bildi") — yol haritası 3b, 2026-09-27.
-- Soru, anasayfada gün tarihine göre deterministik seçiliyor (bkz. app/src/lib/homeHighlights.ts);
-- bu tablo sadece o sorulara verilen cevapları tutar.
--
-- Güvenlik:
--   - Tablo RLS'li ve HİÇ policy yok: doğrudan okuma/yazma kapalı, sadece aşağıdaki iki
--     SECURITY DEFINER fonksiyon erişir.
--   - Doğru/yanlış İSTEMCİDEN ALINMAZ: istemci sadece seçtiği şıkkı gönderir, doğruluk
--     question_choices'tan hesaplanır (istatistik sahte "doğru" cevaplarla şişirilemesin).
--   - Kişi başına günde 1 cevap: girişli → auth.uid(), misafir → tarayıcının ürettiği anonim
--     anahtar (UUID, kişisel veri değil). Misafir anahtarı silip tekrar cevaplayabilir — kabul
--     edilen risk; sayılar "yaklaşık topluluk nabzı", sınav notu değil.
create table if not exists public.daily_question_answers (
  id bigint generated always as identity primary key,
  question_date date not null,
  question_id bigint not null references public.questions(id) on delete cascade,
  choice_id bigint not null references public.question_choices(id) on delete cascade,
  is_correct boolean not null,
  user_id uuid references auth.users(id) on delete cascade,
  anon_key uuid,
  created_at timestamptz not null default now(),
  constraint daily_question_answers_actor check ((user_id is not null) <> (anon_key is not null))
);

create unique index if not exists daily_question_answers_user_uniq
  on public.daily_question_answers (question_date, user_id) where user_id is not null;
create unique index if not exists daily_question_answers_anon_uniq
  on public.daily_question_answers (question_date, anon_key) where anon_key is not null;
create index if not exists daily_question_answers_stats_idx
  on public.daily_question_answers (question_date, question_id);

alter table public.daily_question_answers enable row level security;

-- Günün (Türkiye saati) istatistiği.
create or replace function public.get_daily_question_stats(p_question_id bigint)
returns table (total integer, correct integer)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer, count(*) filter (where is_correct)::integer
  from public.daily_question_answers
  where question_date = (now() at time zone 'Europe/Istanbul')::date
    and question_id = p_question_id;
$$;

-- Cevabı kaydeder (günde bir; tekrar gönderimde ilk cevap kalır) ve güncel istatistiği döner.
-- is_correct: BU gönderimdeki şıkkın doğruluğu; counted: bu cevap istatistiğe yeni mi eklendi.
create or replace function public.submit_daily_question_answer(p_question_id bigint, p_choice_id bigint, p_anon_key uuid default null)
returns table (is_correct boolean, counted boolean, total integer, correct integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_date date := (now() at time zone 'Europe/Istanbul')::date;
  v_correct boolean;
  v_inserted integer := 0;
begin
  select qc.is_correct into v_correct
  from public.question_choices qc
  join public.questions q on q.id = qc.question_id and q.is_active
  where qc.id = p_choice_id and qc.question_id = p_question_id;
  if v_correct is null then
    raise exception 'Geçersiz soru/şık';
  end if;
  if v_user is null and p_anon_key is null then
    raise exception 'Kimlik gerekli';
  end if;

  insert into public.daily_question_answers (question_date, question_id, choice_id, is_correct, user_id, anon_key)
  values (v_date, p_question_id, p_choice_id, v_correct, v_user, case when v_user is null then p_anon_key end)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return query
  select v_correct, v_inserted > 0, s.total, s.correct
  from public.get_daily_question_stats(p_question_id) s;
end;
$$;

revoke all on function public.get_daily_question_stats(bigint) from public;
revoke all on function public.submit_daily_question_answer(bigint, bigint, uuid) from public;
grant execute on function public.get_daily_question_stats(bigint) to anon, authenticated;
grant execute on function public.submit_daily_question_answer(bigint, bigint, uuid) to anon, authenticated;
