-- Ders+sınıf bazında haftalık ders saati (ör. 6. sınıf Din Kültürü = 2 saat/hafta).
-- Ünitelerin start_week/end_week'ini otomatik hesaplamak için kullanılır
-- (bkz. app/src/lib/recalculateUnitWeeks.ts).
alter table public.lesson_grades
  add column if not exists weekly_hours integer check (weekly_hours is null or weekly_hours >= 1);
