-- Takdir/Teşekkür belgesi hesaplama aracı (/takdir-tesekkur-hesaplama).
-- Giriş yapan kullanıcının girdiği dönem notu tahminini saklar. Dersler burada SERBEST METİN
-- olarak tutulur (lessons tablosuna FK yok, yeni satır da eklemiyoruz) — amaç, bu hesaplamaya
-- Resim/Beden Eğitimi/Müzik/seçmeli gibi sistemde hiç bulunmayan dersleri de girebilmek,
-- asıl müfredat lessons tablosunu bu amaçla büyütmemek.
create table public.takdir_tesekkur_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sinif_seviyesi smallint not null check (sinif_seviyesi between 5 and 12),
  donem smallint not null check (donem in (1, 2)),
  behavior_full boolean not null default true,
  all_passed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sinif_seviyesi, donem)
);

create table public.takdir_tesekkur_calculation_lessons (
  id uuid primary key default gen_random_uuid(),
  calculation_id uuid not null references public.takdir_tesekkur_calculations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_name text not null,
  weekly_hours smallint not null check (weekly_hours between 1 and 40),
  score numeric(5, 2) not null check (score between 0 and 100),
  sort_order smallint not null default 0
);

create index takdir_tesekkur_calculation_lessons_calc_idx
  on public.takdir_tesekkur_calculation_lessons (calculation_id);

alter table public.takdir_tesekkur_calculations enable row level security;
alter table public.takdir_tesekkur_calculation_lessons enable row level security;

create policy "own calc select" on public.takdir_tesekkur_calculations
  for select using (auth.uid() = user_id);
create policy "own calc insert" on public.takdir_tesekkur_calculations
  for insert with check (auth.uid() = user_id);
create policy "own calc update" on public.takdir_tesekkur_calculations
  for update using (auth.uid() = user_id);
create policy "own calc delete" on public.takdir_tesekkur_calculations
  for delete using (auth.uid() = user_id);

create policy "own calc lessons select" on public.takdir_tesekkur_calculation_lessons
  for select using (auth.uid() = user_id);
create policy "own calc lessons insert" on public.takdir_tesekkur_calculation_lessons
  for insert with check (auth.uid() = user_id);
create policy "own calc lessons update" on public.takdir_tesekkur_calculation_lessons
  for update using (auth.uid() = user_id);
create policy "own calc lessons delete" on public.takdir_tesekkur_calculation_lessons
  for delete using (auth.uid() = user_id);

-- Header + ders satırlarını tek işlemde değiştirir (kısmi yazım/yarış durumu olmasın diye).
-- security invoker: auth.uid() çağıranın kendi kimliği, RLS normal şekilde devrede.
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

  insert into public.takdir_tesekkur_calculation_lessons (calculation_id, user_id, lesson_name, weekly_hours, score, sort_order)
  select
    v_calc_id,
    v_uid,
    (item ->> 'lesson_name'),
    (item ->> 'weekly_hours')::smallint,
    (item ->> 'score')::numeric,
    coalesce((item ->> 'sort_order')::smallint, 0)
  from jsonb_array_elements(p_lessons) as item;

  return v_calc_id;
end;
$$;

grant execute on function public.save_takdir_tesekkur_calculation(smallint, smallint, boolean, boolean, jsonb) to authenticated;
