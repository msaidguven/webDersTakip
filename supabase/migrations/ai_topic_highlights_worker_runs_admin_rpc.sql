-- Admin panelindeki "AI Anahtar Kavramlar" sekmesi (kullanıcının 2026-09-25 isteği:
-- "AI içerikleri / AI soruları gibi anahtar kavram worker'ının son 20 çalışmasını da göreyim").
-- Çalışma kaydı + konunun etiketi + o konuda şu an yayında olan anahtar kavramlar tek
-- sorguda dönsün diye RPC; zincirleme client sorgusu yazılmıyor.
create or replace function public.get_ai_topic_highlights_worker_runs(p_limit int default 20)
returns table (
  id bigint,
  generated boolean,
  reason text,
  topic_id bigint,
  created_at timestamptz,
  topic_title text,
  unit_title text,
  lesson_name text,
  grade_name text,
  highlights jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.generated,
    r.reason,
    r.topic_id,
    r.created_at,
    t.title as topic_title,
    u.title as unit_title,
    l.name as lesson_name,
    g.name as grade_name,
    coalesce((
      select jsonb_agg(
               jsonb_build_object('icon', h.icon, 'title', h.title, 'description', h.description)
               order by h.order_no, h.id
             )
      from public.topic_content_highlights h
      join public.topic_contents tc on tc.id = h.topic_content_id
      where tc.topic_id = r.topic_id
    ), '[]'::jsonb) as highlights
  from public.ai_topic_highlights_worker_runs r
  left join public.topics t on t.id = r.topic_id
  left join public.units u on u.id = t.unit_id
  left join public.lessons l on l.id = u.lesson_id
  left join public.grades g on g.id = u.grade_id
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.get_ai_topic_highlights_worker_runs(int) from public;
grant execute on function public.get_ai_topic_highlights_worker_runs(int) to service_role;

-- Sekmedeki "kaç konu bekliyor" rozeti: worker'ın kuyruğunu (find_next_topic_missing_highlights
-- ile AYNI uygunluk koşulu) sayar.
create or replace function public.count_topics_missing_highlights()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.topics t
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  join public.topic_contents tc on tc.topic_id = t.id and tc.is_published = true
  where t.is_active = true
    and not exists (select 1 from public.topic_content_highlights h where h.topic_content_id = tc.id);
$$;

revoke all on function public.count_topics_missing_highlights() from public;
grant execute on function public.count_topics_missing_highlights() to service_role;
