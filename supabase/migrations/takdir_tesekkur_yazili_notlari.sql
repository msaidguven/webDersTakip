-- Takdir/Teşekkür hesaplama: tek "dönem notu" yerine 1. ve 2. yazılı sınav puanı (gerçek dönem
-- notu bu ikisinin ortalamasıdır, hesaplama app/src/lib/takdirTesekkurHesaplama.ts#donemNotu'da
-- yapılır). Her ikisi de boş bırakılabilir (henüz girilmemiş not).
alter table public.takdir_tesekkur_calculation_lessons
  drop column score,
  add column yazili1 numeric(5, 2) check (yazili1 is null or yazili1 between 0 and 100),
  add column yazili2 numeric(5, 2) check (yazili2 is null or yazili2 between 0 and 100);

create or replace function public.save_takdir_tesekkur_calculation(
  p_sinif_seviyesi smallint,
  p_donem smallint,
  p_behavior_full boolean,
  p_all_passed boolean,
  p_lessons jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calc_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Giriş yapmanız gerekiyor';
  end if;

  insert into public.takdir_tesekkur_calculations (user_id, sinif_seviyesi, donem, behavior_full, all_passed)
  values (v_uid, p_sinif_seviyesi, p_donem, p_behavior_full, p_all_passed)
  on conflict (user_id, sinif_seviyesi, donem)
  do update set
    behavior_full = excluded.behavior_full,
    all_passed = excluded.all_passed,
    updated_at = now()
  returning id into v_calc_id;

  delete from public.takdir_tesekkur_calculation_lessons where calculation_id = v_calc_id;

  insert into public.takdir_tesekkur_calculation_lessons (calculation_id, user_id, lesson_name, weekly_hours, yazili1, yazili2, sort_order)
  select
    v_calc_id,
    v_uid,
    (item ->> 'lesson_name'),
    (item ->> 'weekly_hours')::smallint,
    (item ->> 'yazili1')::numeric,
    (item ->> 'yazili2')::numeric,
    coalesce((item ->> 'sort_order')::smallint, 0)
  from jsonb_array_elements(p_lessons) as item;

  return v_calc_id;
end;
$$;
