-- Lisede dönem puanı, sınavlarla birlikte performans çalışması puanlarını da içerir
-- (Ortaöğretim Kurumları Yönetmeliği MADDE 51/1).
alter table public.takdir_tesekkur_calculation_lessons
  add column performans1 numeric(5, 2) check (performans1 is null or performans1 between 0 and 100),
  add column performans2 numeric(5, 2) check (performans2 is null or performans2 between 0 and 100),
  add column performans3 numeric(5, 2) check (performans3 is null or performans3 between 0 and 100);

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
    calculation_id, user_id, lesson_name, weekly_hours,
    yazili1, yazili2, yazili3, performans1, performans2, performans3,
    katilim1, katilim2, katilim3, proje, sort_order
  )
  select
    v_calc_id,
    v_uid,
    (item ->> 'lesson_name'),
    (item ->> 'weekly_hours')::smallint,
    (item ->> 'yazili1')::numeric,
    (item ->> 'yazili2')::numeric,
    (item ->> 'yazili3')::numeric,
    (item ->> 'performans1')::numeric,
    (item ->> 'performans2')::numeric,
    (item ->> 'performans3')::numeric,
    (item ->> 'katilim1')::numeric,
    (item ->> 'katilim2')::numeric,
    (item ->> 'katilim3')::numeric,
    (item ->> 'proje')::numeric,
    coalesce((item ->> 'sort_order')::smallint, 0)
  from jsonb_array_elements(p_lessons) as item;

  return v_calc_id;
end;
$$;

-- Hesaplama sonucuna itiraz/hata bildirimi. Herkes ekleyebilir (giriş yapmadan da), ama
-- okuma politikası yoktur: yalnızca service role (yönetici) okur.
create table public.takdir_hesaplama_geri_bildirim (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  sinif_seviyesi smallint not null check (sinif_seviyesi between 5 and 12),
  mesaj text not null check (char_length(mesaj) between 10 and 1000),
  ozet jsonb check (ozet is null or pg_column_size(ozet) < 20000),
  created_at timestamptz not null default now()
);

alter table public.takdir_hesaplama_geri_bildirim enable row level security;

create policy "geri bildirim ekleme" on public.takdir_hesaplama_geri_bildirim
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
