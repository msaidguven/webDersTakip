-- MEB müfredatındaki ünitenin resmi ders saati (ör. "16 ders saati"). weekly_hours
-- ile birlikte ünitenin kaç haftaya yayılacağını hesaplamak için kullanılır
-- (bkz. app/src/lib/recalculateUnitWeeks.ts).
alter table public.units
  add column if not exists duration_hours integer check (duration_hours is null or duration_hours >= 1);
