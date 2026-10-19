-- Ortaokulda "dönem notu", yazılı sınavların yanı sıra "ders etkinliklerine katılım" puanı
-- (halk arasında sözlü notu) ve varsa proje puanıyla hesaplanır (MEB Okul Öncesi Eğitim ve
-- İlköğretim Kurumları Yönetmeliği MADDE 22/3 ve MADDE 27/2-a). Hesaplama mantığı
-- app/src/lib/takdirTesekkurHesaplama.ts#donemNotu'da.
alter table public.takdir_tesekkur_calculation_lessons
  add column katilim1 numeric(5, 2) check (katilim1 is null or katilim1 between 0 and 100),
  add column katilim2 numeric(5, 2) check (katilim2 is null or katilim2 between 0 and 100),
  add column katilim3 numeric(5, 2) check (katilim3 is null or katilim3 between 0 and 100),
  add column proje numeric(5, 2) check (proje is null or proje between 0 and 100);

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

  insert into public.takdir_tesekkur_calculation_lessons (
    calculation_id, user_id, lesson_name, weekly_hours, yazili1, yazili2, yazili3, katilim1, katilim2, katilim3, proje, sort_order
  )
  select
    v_calc_id,
    v_uid,
    (item ->> 'lesson_name'),
    (item ->> 'weekly_hours')::smallint,
    (item ->> 'yazili1')::numeric,
    (item ->> 'yazili2')::numeric,
    (item ->> 'yazili3')::numeric,
    (item ->> 'katilim1')::numeric,
    (item ->> 'katilim2')::numeric,
    (item ->> 'katilim3')::numeric,
    (item ->> 'proje')::numeric,
    coalesce((item ->> 'sort_order')::smallint, 0)
  from jsonb_array_elements(p_lessons) as item;

  return v_calc_id;
end;
$$;
