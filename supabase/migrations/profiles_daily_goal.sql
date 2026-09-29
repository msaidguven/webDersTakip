-- Günlük hedefi öğrenci seçer (İlerlemem, yol haritası 4i — 2026-09-29): 10 / 20 / 40 soru.
-- Eskiden herkes için sabit 20'ydi (DAILY_GOAL_QUESTIONS). Mevcut öğrenciler 20'de kalır.

alter table public.profiles
  add column if not exists daily_goal smallint not null default 20;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_daily_goal_check') then
    alter table public.profiles
      add constraint profiles_daily_goal_check check (daily_goal in (10, 20, 40));
  end if;
end $$;

-- Değiştirme tek yoldan: kullanıcı yalnızca KENDİ hedefini, yalnızca izinli değerlere çekebilir.
-- (profiles'ın genel UPDATE yoluna bu sütunu açmaktan daha dar bir yüzey.)
create or replace function public.set_my_daily_goal(p_goal integer)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_goal not in (10, 20, 40) then
    raise exception 'Geçersiz günlük hedef: %', p_goal using errcode = '22023';
  end if;

  update public.profiles set daily_goal = p_goal where id = v_user_id returning daily_goal into v_goal;
  return v_goal;
end;
$$;

revoke all on function public.set_my_daily_goal(integer) from public, anon;
grant execute on function public.set_my_daily_goal(integer) to authenticated;
