-- Tarayıcı bildirimleri (Web Push) — yol haritası 3c, 2026-09-27.
-- Öğrenci "Hatırlatma al" dediğinde tarayıcının verdiği abonelik (endpoint + anahtarlar) burada
-- tutulur; /api/cron/push-reminders her akşam 19:00'da (TR) bugün hiç soru çözmemiş öğrencilere
-- günde EN FAZLA bir hatırlatma gönderir.
--
-- Yazma işlemleri /api/push/subscribe üzerinden (oturum doğrulandıktan sonra service role ile):
-- aynı cihazda hesap değişirse endpoint yeni kullanıcıya taşınabilsin diye. Öğrenci kendi
-- aboneliklerini görebilir/silebilir (RLS).
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_notified_on date
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Bu akşam hatırlatılacak öğrenciler: aboneliği olan, BUGÜN (TR) hiç cevap vermemiş ve bugün
-- henüz bildirim almamış. streak = dünden geriye kesintisiz çalışılan gün sayısı (bugün boş
-- olduğu için seri bu gece bozulacak — getCurrentStreak ile aynı mantık); due_count = tekrar
-- zamanı gelmiş aktif sorular (notify_due_srs_reviews ile aynı sınıf kuralı).
create or replace function public.get_push_reminder_candidates()
returns table (user_id uuid, streak integer, due_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (now() at time zone 'Europe/Istanbul')::date as d
  ),
  subs as (
    select ps.user_id
    from public.push_subscriptions ps
    group by ps.user_id
    having bool_and(ps.last_notified_on is null or ps.last_notified_on < (select d from today))
  ),
  answer_days as (
    select a.user_id, (a.created_at at time zone 'Europe/Istanbul')::date as d
    from public.test_session_answers a
    where a.user_id in (select user_id from subs)
      and a.created_at > now() - interval '70 days'
    group by 1, 2
  ),
  eligible as (
    select s.user_id
    from subs s
    where not exists (
      select 1 from answer_days ad where ad.user_id = s.user_id and ad.d = (select d from today)
    )
  ),
  streaks as (
    -- Boşluk-ada tekniği: günler yeniden eskiye sıralanınca ardışık günlerde d + sıra sabit
    -- kalır; en yeni gün dün ise o adanın anahtarı "bugün"e eşittir.
    select x.user_id, count(*)::integer as streak
    from (
      select ad.user_id, ad.d + (row_number() over (partition by ad.user_id order by ad.d desc))::integer as grp
      from answer_days ad
      where ad.user_id in (select user_id from eligible) and ad.d < (select d from today)
    ) x
    where x.grp = (select d from today)
    group by x.user_id
  ),
  due as (
    select uqs.user_id, count(*)::integer as due_count
    from public.user_question_stats uqs
    join public.questions q on q.id = uqs.question_id and q.is_active
    join public.profiles p on p.id = uqs.user_id
    where uqs.user_id in (select user_id from eligible)
      and uqs.next_review_at <= now()
      and (p.grade_id is null or uqs.grade_id = p.grade_id)
    group by uqs.user_id
  )
  select e.user_id, coalesce(s.streak, 0), coalesce(d.due_count, 0)
  from eligible e
  left join streaks s on s.user_id = e.user_id
  left join due d on d.user_id = e.user_id;
$$;

revoke all on function public.get_push_reminder_candidates() from public, anon, authenticated;
grant execute on function public.get_push_reminder_candidates() to service_role;
