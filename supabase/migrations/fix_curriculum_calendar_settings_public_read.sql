-- BUG: curriculum_calendar_settings tablosunda RLS açık ama hiç SELECT policy'si yok,
-- bu yüzden herkese açık /ders sayfaları (anon client ile, admin oturumu olmadan) bu
-- tabloyu okuyamıyor — getCurriculumCalendar() termStartDate/termEndDate için null
-- alıyor ve routeParsing.ts sabit "Eylül'ün ilk Pazartesi'si" varsayımına düşüyor. Admin
-- panelde ayarlanan gerçek başlangıç tarihinden farklıysa (ör. bu projede olduğu gibi
-- 14 Eylül yerine varsayılan 7 Eylül) TÜM Kazanımlar modali bir hafta kayıyor — bir
-- haftanın kazanımı/özel içeriği bir sonraki haftada görünüyor, o hafta ise boş kalıyor.
--
-- special_week_events tablosunda zaten herkese açık bir SELECT policy var (breaks/özel
-- haftalar public sayfada görünüyor); curriculum_calendar_settings için aynısı eksikti.
-- Bu ayarların içeriği hassas değil (sadece dönem başlangıç/bitiş tarihi), o yüzden
-- herkese SELECT açmak güvenli — yazma hâlâ sadece requireAdmin + service-role client
-- üzerinden yapılıyor (bkz. app/api/admin/manage/calendar-settings/route.ts), bu policy
-- INSERT/UPDATE/DELETE'e dokunmuyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

drop policy if exists "curriculum_calendar_settings_public_read" on public.curriculum_calendar_settings;

create policy "curriculum_calendar_settings_public_read"
  on public.curriculum_calendar_settings
  for select
  to anon, authenticated
  using (true);
