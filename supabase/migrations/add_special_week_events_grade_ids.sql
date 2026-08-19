-- Bir özel hafta (special_week_events) artık birden fazla sınıfa birden atanabilsin diye
-- (ör. "Fen Laboratuvarı Kuralları" 5-8. sınıfların hepsinde geçerli olsun) tekil grade_id
-- yerine bir sınıf listesi (grade_ids) kullanıyoruz. NULL/boş = tüm sınıflar.
-- Var olan tekil grade_id değerleri grade_ids'e taşınır; grade_id kolonu geriye dönük
-- uyumluluk için dokunulmadan kalıyor ama artık uygulama tarafından okunmuyor/yazılmıyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.special_week_events
  add column if not exists grade_ids integer[];

update public.special_week_events
set grade_ids = array[grade_id]
where grade_id is not null and grade_ids is null;
