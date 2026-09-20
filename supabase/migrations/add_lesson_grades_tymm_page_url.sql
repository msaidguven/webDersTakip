-- Ders+sınıf bazında son kullanılan TYMM ders/sınıf sayfası URL'i. Admin panelde
-- "Kontrol Et" sekmesinde bir kez girilip karşılaştırma çalıştırıldığında kaydedilir,
-- sonraki ziyaretlerde aynı ders/sınıf seçildiğinde otomatik doldurulur.
alter table public.lesson_grades
  add column if not exists tymm_page_url text;

-- Ders+sınıf bazında "TYMM ile doğrulandı" işareti — Kontrol Et'te tüm ünite/konu/kazanımlar
-- eşleşince otomatik, ya da admin elle "Doğru olarak işaretle" deyince true olur. Ders seçim
-- adımında yeşil tik olarak gösterilir. Ünite/konu/kazanım silindiğinde (nereden silinirse
-- silinsin) aşağıdaki trigger'lar bunu otomatik false'a çeker — TYMM URL'i silinmez, sadece
-- "doğrulanmış" durumu düşer, çünkü içerik artık DB'de olmadığı için TYMM ile aynı olduğu
-- garantisi bozulmuş olur.
alter table public.lesson_grades
  add column if not exists tymm_verified boolean not null default false;

create or replace function public.reset_lesson_grade_tymm_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lesson_id bigint;
  v_grade_id bigint;
begin
  if TG_TABLE_NAME = 'units' then
    v_lesson_id := OLD.lesson_id;
    v_grade_id := OLD.grade_id;
  elsif TG_TABLE_NAME = 'topics' then
    select u.lesson_id, u.grade_id into v_lesson_id, v_grade_id
    from public.units u where u.id = OLD.unit_id;
  elsif TG_TABLE_NAME = 'outcomes' then
    select u.lesson_id, u.grade_id into v_lesson_id, v_grade_id
    from public.topics t
    join public.units u on u.id = t.unit_id
    where t.id = OLD.topic_id;
  end if;

  if v_lesson_id is not null and v_grade_id is not null then
    update public.lesson_grades
      set tymm_verified = false
      where lesson_id = v_lesson_id and grade_id = v_grade_id and tymm_verified = true;
  end if;

  return OLD;
end;
$$;

drop trigger if exists trg_units_reset_tymm_verified on public.units;
create trigger trg_units_reset_tymm_verified
  after delete on public.units
  for each row execute function public.reset_lesson_grade_tymm_verified();

drop trigger if exists trg_topics_reset_tymm_verified on public.topics;
create trigger trg_topics_reset_tymm_verified
  after delete on public.topics
  for each row execute function public.reset_lesson_grade_tymm_verified();

drop trigger if exists trg_outcomes_reset_tymm_verified on public.outcomes;
create trigger trg_outcomes_reset_tymm_verified
  after delete on public.outcomes
  for each row execute function public.reset_lesson_grade_tymm_verified();
