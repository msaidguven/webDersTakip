-- Admin anasayfası "Yazılı kullanımı" (2026-10-29): "Yeni yazılı aç" (yazili_attempts) kaç kişi, hangi yazılıyı,
-- kaç kez açmış ve kaçı yapay zekâya gönderilmiş. Tek çağrıda:
--   summary — bugün / son 7 gün / son 30 gün / tümü için: users (farklı kişi), attempts (açılan yazılı),
--             sent (cevapları AI'ye gönderilen = submitted_at dolu), graded (puanlanan), open (açıp hiç göndermeyen)
--   exams   — yazılı başına aynı sayılar + ortalama puan yüzdesi (yalnız puanlananlar), en çok kullanılan üstte
-- Admin hesapları ve test hesapları HİÇBİR ZAMAN sayılmaz (kullanıcı kararı 2026-10-29): admin = role='admin',
-- test = profiles.is_test_account (aşağıda 3 test hesabına işaretlenir; yeni test hesabı açılırsa elle işaretlenmeli).
-- Günler Türkiye saatine göre. Okuma yalnız admin API'si (service role) üzerinden; client çağıramaz.

-- Test hesabı işareti: yalnız servis rolü yazar (profil API'sinin EDITABLE_FIELDS listesinde yok, kullanıcı değiştiremez).
alter table public.profiles add column if not exists is_test_account boolean not null default false;
update public.profiles set is_test_account = true
where username in ('ogrencideneme', 'test_ogretmen', 'admindeneme') and not is_test_account;

create or replace function public.admin_yazili_usage()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select ya.id, ya.user_id, ya.exam_id, ya.status, ya.total_score, ya.created_at, ya.submitted_at
    from public.yazili_attempts ya
    join public.profiles p on p.id = ya.user_id
    where p.role is distinct from 'admin' and not p.is_test_account
  ),
  windows(k, since) as (
    values
      ('today', date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
      ('d7', now() - interval '7 days'),
      ('d30', now() - interval '30 days'),
      ('all', '-infinity'::timestamptz)
  ),
  summary as (
    select w.k,
      count(distinct a.user_id) as users,
      count(a.id) as attempts,
      count(a.id) filter (where a.submitted_at is not null) as sent,
      count(a.id) filter (where a.status = 'graded') as graded,
      count(a.id) filter (where a.status = 'in_progress') as open
    from windows w
    left join a on a.created_at >= w.since
    group by w.k
  ),
  max_points as (
    select attempt_id, sum(points) as total from public.yazili_attempt_answers group by attempt_id
  ),
  per_exam as (
    select e.id as exam_id, g.name as grade, l.name as lesson, e.term, e.exam_no,
      count(distinct a.user_id) as users,
      count(a.id) as attempts,
      count(a.id) filter (where a.submitted_at is not null) as sent,
      count(a.id) filter (where a.status = 'graded') as graded,
      round(avg(a.total_score / nullif(m.total, 0) * 100) filter (where a.status = 'graded'))::int as avg_pct
    from a
    join public.exams e on e.id = a.exam_id
    join public.grades g on g.id = e.grade_id
    join public.lessons l on l.id = e.lesson_id
    left join max_points m on m.attempt_id = a.id
    group by e.id, g.name, l.name, e.term, e.exam_no
  )
  select jsonb_build_object(
    'summary', (select jsonb_object_agg(s.k, jsonb_build_object('users', s.users, 'attempts', s.attempts, 'sent', s.sent, 'graded', s.graded, 'open', s.open)) from summary s),
    'exams', coalesce((select jsonb_agg(to_jsonb(x) order by x.attempts desc, x.users desc, x.exam_id) from per_exam x), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_yazili_usage() from public, anon, authenticated;
grant execute on function public.admin_yazili_usage() to service_role;
