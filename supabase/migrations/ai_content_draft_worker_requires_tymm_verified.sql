-- Otomatik içerik üretimi (20 dakikada bir çalışan ai-content-draft-worker, bkz.
-- topic_section_content_drafts.sql) artık sadece TYMM ile doğrulanmış (yıllık plan
-- kazanımları kontrol edilmiş) ders/sınıflar için konu seçiyor — kullanıcının 2026-09-20
-- isteği: "yıllık plan kazanımları doğrulanmış olmalı". Doğrulanmamış bir ders/sınıfta
-- (lesson_grades.tymm_verified = false/null) konu/kazanım yapısı hâlâ yanlış/eksik
-- olabilir (bkz. Kontrol Et ekranındaki tüm bugünkü düzeltmeler) — böyle bir yapı üzerinden
-- otomatik içerik üretmek, yanlış kazanımlara dayalı içerik üretme riski taşır.
--
-- ÖNEMLİ: bir önceki hâli (topic_section_content_drafts_require_dedup.sql) esas alındı —
-- source_kind/book-kaynak/dedup mantığının HİÇBİRİ değişmedi, sadece lesson_grades join'i
-- ve tymm_verified şartı eklendi. Dönüş şeması aynı kaldığı için normalde DROP gerekmez,
-- ama önceki "create or replace" denemesinde Postgres "cannot change return type" hatası
-- verdiği için (muhtemelen deploy edilmemiş ara bir sürümle karşılaştırdı) garanti olsun
-- diye önce DROP ediliyor.
drop function if exists public.find_next_ai_content_draft_topic();

create or replace function public.find_next_ai_content_draft_topic()
returns table (
  topic_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint,
  source_kind text
)
language sql stable security definer set search_path = public
as $$
  with latest_draft as (
    select distinct on (d.topic_id) d.topic_id, d.status
    from public.topic_section_content_drafts d
    order by d.topic_id, d.created_at desc
  ),
  rejected_counts as (
    select d.topic_id, count(*) as cnt
    from public.topic_section_content_drafts d
    where d.status = 'rejected'
    group by d.topic_id
  )
  select
    t.id as topic_id, u.id as unit_id, u.lesson_id, u.grade_id,
    case
      when exists (
        select 1 from public.rag_documents rd
        where rd.topic_id = t.id and rd.source = 'ai_generated' and rd.is_synthesis = true
      ) and u.rag_dedup_checked_at is not null then 'synthesis'
      else 'book'
    end as source_kind
  from public.topics t
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  join public.lesson_grades lg on lg.lesson_id = u.lesson_id and lg.grade_id = u.grade_id and lg.tymm_verified = true
  left join latest_draft ld on ld.topic_id = t.id
  left join rejected_counts rc on rc.topic_id = t.id
  where t.is_active = true
    and (
      (
        exists (
          select 1 from public.rag_documents rd
          where rd.topic_id = t.id and rd.source = 'ai_generated' and rd.is_synthesis = true
        )
        and u.rag_dedup_checked_at is not null
      )
      or exists (select 1 from public.rag_documents rd where rd.unit_id = u.id)
    )
    and not exists (select 1 from public.topic_contents tc where tc.topic_id = t.id)
    and not exists (select 1 from public.outcomes o where o.topic_id = t.id and (o.code is null or trim(o.code) = ''))
    and exists (select 1 from public.outcomes o where o.topic_id = t.id)
    and (ld.topic_id is null or ld.status <> 'pending')
    and (ld.status is null or ld.status <> 'rejected' or coalesce(rc.cnt, 0) < 2)
  order by g.order_no, l.order_no, u.order_no, t.order_no
  limit 1;
$$;
