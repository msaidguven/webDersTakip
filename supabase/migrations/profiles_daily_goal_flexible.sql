-- Günlük hedef esnek (kullanıcının 2026-10-02 isteği): 10/20/40 yerine 5–100 arası, 5'er adımla.
-- Profilim → Ayarlar ve İlerlemem başlığındaki seçici aynı RPC'yi kullanır. Mevcut değerler
-- (10/20/40) yeni kurala zaten uyuyor, veri taşıma gerekmez.

alter table public.profiles drop constraint if exists profiles_daily_goal_check;
alter table public.profiles
  add constraint profiles_daily_goal_check check (daily_goal between 5 and 100 and daily_goal % 5 = 0);

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
  if p_goal is null or p_goal < 5 or p_goal > 100 or p_goal % 5 <> 0 then
    raise exception 'Geçersiz günlük hedef: %', p_goal using errcode = '22023';
  end if;

  update public.profiles set daily_goal = p_goal where id = v_user_id returning daily_goal into v_goal;
  return v_goal;
end;
$$;

revoke all on function public.set_my_daily_goal(integer) from public, anon;
grant execute on function public.set_my_daily_goal(integer) to authenticated;
