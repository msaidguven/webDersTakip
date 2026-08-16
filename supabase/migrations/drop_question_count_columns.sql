-- question_count kolonu units/topics/lesson_grades/grades üzerinde elle bakımı gereken bir
-- sayaçtı; soru eklenince/silinince hiçbir kod yolu bunu güncellemiyordu (admin panelinde ve
-- ders sayfalarında görülen sayılar zamanla gerçek soru sayısından sapıyordu). Bu sayaçlara
-- güvenen tüm kod, questions/question_usages/question_outcomes üzerinden CANLI hesaplanan bir
-- sayıya taşındı (bkz. app/src/lib/questionCounts.ts) — artık bu kolonlara ihtiyaç yok.
--
-- NOT: grades.question_count ve lesson_grades.question_count, bu web reposunun hiç çağırmadığı
-- 3 ayrı Supabase SQL fonksiyonunda (get_active_grades, get_grade_by_id,
-- get_active_grades_paginated — supabase/functions/) hâlâ referans alınıyor. Bu fonksiyonları
-- başka bir tüketici (ör. mobil uygulama) çağırıyorsa, bu migration'dan sonra hata verirler.
alter table public.units drop column if exists question_count;
alter table public.topics drop column if exists question_count;
alter table public.lesson_grades drop column if exists question_count;
alter table public.grades drop column if exists question_count;
