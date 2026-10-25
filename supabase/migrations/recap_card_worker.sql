-- Hap bilgi kartı geri doldurma (2026-10-24): içerik worker'ı (:23) üretecek konu bulamadığında boşta
-- kalmasın, kartı eksik bir konuya hap bilgi kartı üretsin (saatte 1 konu, bkz. app/api/rag/generate-topic-content).
-- Yeni konularda kart zaten içerikle aynı çağrıda üretiliyor.

-- Worker kayıtları aynı tabloda: kind ile ayrılır, topic_id başarısızlık sayımı için.
alter table public.ai_content_draft_worker_runs
  add column if not exists kind text not null default 'content',
  add column if not exists topic_id bigint;

create index if not exists idx_ai_content_draft_worker_runs_recap_fail
  on public.ai_content_draft_worker_runs(topic_id)
  where kind = 'recap_card' and not generated;

-- Sıradaki konu: anlatımı olup kartı olmayan bölümü bulunan, 3 kez başarısız olmamış konular. Öncelik bu hafta
-- ve sonrası (yakından uzağa), sonra geçmiş haftalar (yakından uzağa), haftası atanmamışlar en sonda.
create or replace function public.find_next_recap_card_topic(p_current_week int)
returns table (topic_id bigint)
language sql stable security definer set search_path = public
as $$
  with candidates as (
    select tc.topic_id
    from public.topic_contents tc
    join public.topic_content_sections s on s.topic_content_id = tc.id
    where s.recap_card is null and coalesce(btrim(s.body_markdown), '') <> ''
    group by tc.topic_id
  ),
  failures as (
    select r.topic_id, count(*) as n
    from public.ai_content_draft_worker_runs r
    where r.kind = 'recap_card' and not r.generated and r.topic_id is not null
    group by r.topic_id
  ),
  weeks as (
    select o.topic_id, min(w.start_week) as start_week
    from public.outcomes o
    join public.outcome_weeks w on w.outcome_id = o.id
    where o.is_current
    group by o.topic_id
  )
  select c.topic_id
  from candidates c
  left join failures f on f.topic_id = c.topic_id
  left join weeks w on w.topic_id = c.topic_id
  where coalesce(f.n, 0) < 3
  order by (w.start_week is null), (w.start_week < p_current_week), abs(w.start_week - p_current_week), c.topic_id
  limit 1;
$$;

-- Admin uyarısı: 3 kez denenip kartı hâlâ eksik kalan konu sayısı.
create or replace function public.count_recap_card_failed_topics()
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from (
    select r.topic_id
    from public.ai_content_draft_worker_runs r
    where r.kind = 'recap_card' and not r.generated and r.topic_id is not null
    group by r.topic_id
    having count(*) >= 3
  ) f
  where exists (
    select 1
    from public.topic_contents tc
    join public.topic_content_sections s on s.topic_content_id = tc.id
    where tc.topic_id = f.topic_id and s.recap_card is null and coalesce(btrim(s.body_markdown), '') <> ''
  );
$$;

revoke all on function public.find_next_recap_card_topic(int) from public, anon, authenticated;
revoke all on function public.count_recap_card_failed_topics() from public, anon, authenticated;
grant execute on function public.find_next_recap_card_topic(int) to service_role;
grant execute on function public.count_recap_card_failed_topics() to service_role;
