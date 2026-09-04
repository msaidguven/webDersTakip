-- SRS tekrar sistemi şu ana kadar tamamen pasifti: kullanıcı /panel'i açmadıkça tekrar
-- borcunun farkına varmıyordu (bkz. app/src/lib/dashboardSrs.ts). Bu fonksiyon, notifications
-- tablosunun (bkz. notifications.sql) zaten var olan bildirim akışına yeni bir tür ekliyor —
-- app/api/cron/srs-reminder-notify her gün bunu çağırıyor.
--
-- Kural: tekrar borcu > 0 olan ve okunmamış bir 'srs_review_due' bildirimi ZATEN olmayan her
-- kullanıcıya bir bildirim ekle. "Okunmamış varsa atla" kuralı, kullanıcı zili hiç açmasa bile
-- her gün yeni bir bildirim birikmesini (spam) engelliyor — bildirimi okuyunca (veya silince)
-- ertesi gün, o anki güncel borç sayısıyla yeni bir tane oluşur.
create or replace function public.notify_due_srs_reviews()
returns integer
language sql
security definer
set search_path = public
as $$
  with due as (
    select uqs.user_id, count(*) as due_count
    from public.user_question_stats uqs
    join public.profiles p on p.id = uqs.user_id
    where uqs.next_review_at <= now()
      and (p.grade_id is null or uqs.grade_id = p.grade_id)
      and not exists (
        select 1 from public.notifications n
        where n.user_id = uqs.user_id
          and n.type = 'srs_review_due'
          and n.read_at is null
      )
    group by uqs.user_id
  ),
  inserted as (
    insert into public.notifications (user_id, type, title, body, link)
    select
      user_id,
      'srs_review_due',
      'Tekrar zamanı geldi',
      due_count || ' soru için tekrar zamanı geldi. Hatırlamanı pekiştirmek için tam zamanı.',
      '/tekrar'
    from due
    returning 1
  )
  select count(*)::integer from inserted;
$$;

grant execute on function public.notify_due_srs_reviews() to service_role;
