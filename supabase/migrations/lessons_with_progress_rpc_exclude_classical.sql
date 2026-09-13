-- web_get_lessons_with_progress hâlâ question_type_id=4 (klasik/açık uçlu) soruları
-- total_questions'a dahil ediyordu — bu sorular öğrenciye hiç gösterilmediği/çözülmediği
-- için panelin "Derslerim" kartlarındaki ilerleme yüzdesi (solved_questions/total_questions)
-- hiçbir zaman %100'e ulaşamıyordu (kullanıcı raporu, 2026-09-13: "ilerleme çubuğu
-- düzelmemiş klasik soruları da sayıyor"). Bu, dashboardUnits.ts'teki JS tarafı sorgusuna
-- (questions.neq('question_type_id', 4)) zaten uygulanmış aynı düzeltmenin bu RPC'ye de
-- uygulanmamış hâliydi.
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
  left join questions q on q.topic_id = t.id and q.is_active = true and q.question_type_id <> 4
  left join test_session_answers tsa on tsa.question_id = q.id and tsa.user_id = p_user_id
  where lg.grade_id = p_grade_id and lg.is_active = true
  group by l.id, l.name, l.icon
  order by l.name;
$$;

grant execute on function public.web_get_lessons_with_progress(uuid, bigint) to anon, authenticated, service_role;
