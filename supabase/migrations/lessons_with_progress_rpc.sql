-- getLessonsWithProgressForGrade (app/src/lib/dashboardUnits.ts) panelin ilk açılışında
-- ders kartlarının soru sayısı/ilerlemesini hesaplıyordu ama bunu 5 ARDIŞIK (sequential)
-- Supabase sorgusuyla yapıyordu (lesson_grades→lessons, units, topics, questions,
-- test_session_answers) — her round-trip'in sabit ağ gecikmesi üst üste binip gerçek
-- veriyle 0.5-3 saniye sürüyordu (bkz. kullanıcıyla 2026-09-05 performans tartışması).
-- Bu fonksiyon aynı hesabı TEK bir sorguda, veritabanının kendi join/aggregate motoruyla
-- yapıyor — tek round-trip, önemli ölçüde daha hızlı.
create or replace function public.web_get_lessons_with_progress(p_user_id uuid, p_grade_id bigint)
returns table(
  lesson_id bigint,
  lesson_name text,
  icon text,
  total_questions bigint,
  solved_questions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id as lesson_id,
    l.name as lesson_name,
    coalesce(l.icon, '📘') as icon,
    count(distinct q.id) as total_questions,
    count(distinct tsa.question_id) as solved_questions
  from lesson_grades lg
  join lessons l on l.id = lg.lesson_id and l.is_active = true
  left join units u on u.lesson_id = l.id and u.grade_id = p_grade_id and u.is_active = true
  left join topics t on t.unit_id = u.id and t.is_active = true
  left join questions q on q.topic_id = t.id and q.is_active = true
  left join test_session_answers tsa on tsa.question_id = q.id and tsa.user_id = p_user_id
  where lg.grade_id = p_grade_id and lg.is_active = true
  group by l.id, l.name, l.icon
  order by l.name;
$$;

grant execute on function public.web_get_lessons_with_progress(uuid, bigint) to anon, authenticated, service_role;
