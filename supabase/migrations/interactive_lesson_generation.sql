-- Etkileşimli ders otomatik üretimi (Aşama 2, 2026-11-01): 2. soru worker'ı (Soru AI 2) her çalışmada önce
-- buraya bakar (app/src/lib/interactiveLesson/worker.ts):
--   1) dersi hazır ama Bit sesleri eksik konu varsa sesleri üretir (Azure; birkaç çalışmaya yayılır),
--   2) yoksa içeriği yayında + soru havuzu yeterli sıradaki konunun dersini üretir. Uzun konular parça parça:
--      her çalışmada tek alt konu (önceki bölümlerin özetiyle; tek AI çağrısı 300 sn sınırına rahat sığsın), ders bitene kadar 'partial'.
--      Her parça elle yazılan derslerle aynı denetimden (validateLesson) geçer; geçemezse hata listesiyle
--      yeniden denenir (runs = art arda başarısız deneme; başarılı parça sıfırlar, 3'te vazgeçilir).
-- Elle yazılmış dersler (kodda, registry.ts) bu tabloya girmez, önceliklidir. Şimdilik yalnız admin önizlemesi.
-- Yazma/okuma yalnız sunucudan (service role); RLS açık, policy yok.
create table if not exists public.interactive_lessons (
  topic_id bigint primary key references public.topics(id) on delete cascade,
  status text not null default 'generating' check (status in ('generating', 'partial', 'ready', 'failed')),
  -- LessonDefinition (topicId hariç): { guide, blocks: [{ sectionId, title, steps }] }; 'partial'da üretilen bölümler
  lesson jsonb,
  model text,
  runs integer not null default 0,
  voice_done boolean not null default false,
  last_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interactive_lessons_voice_idx on public.interactive_lessons (updated_at) where status = 'ready' and not voice_done;
alter table public.interactive_lessons enable row level security;
revoke all on public.interactive_lessons from anon, authenticated;

-- Sıradaki konu: önce yarım dersler (sıradaki parça), sonra yeniden denenecekler (başarısız ya da yarıda kalmış,
-- 3 hakka kadar), sonra hiç denenmemiş
-- konulardan içeriği yayında ve en az 4 aktif test sorusu (çoktan seçmeli / boşluk) olan ilk konu.
-- p_exclude: elle yazılmış derslerin konuları. Çakışan iki çalışma aynı konuyu almasın diye satır kilitli.
create or replace function public.claim_next_interactive_lesson_topic(p_exclude bigint[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic bigint;
begin
  select l.topic_id into v_topic
  from public.interactive_lessons l
  where l.runs < 3
    and (l.status = 'partial'
      or (l.status = 'failed' and l.updated_at < now() - interval '50 minutes')
      or (l.status = 'generating' and l.updated_at < now() - interval '30 minutes'))
  order by (l.status = 'partial') desc, l.updated_at
  limit 1
  for update skip locked;

  if v_topic is not null then
    update public.interactive_lessons set status = 'generating', runs = runs + 1, updated_at = now() where topic_id = v_topic;
    return v_topic;
  end if;

  select c.topic_id into v_topic
  from public.topic_contents c
  where c.is_published
    and not (c.topic_id = any (coalesce(p_exclude, '{}')))
    and not exists (select 1 from public.interactive_lessons l where l.topic_id = c.topic_id)
    and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = c.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
  order by c.topic_id
  limit 1;

  if v_topic is null then
    return null;
  end if;
  insert into public.interactive_lessons (topic_id, status, runs) values (v_topic, 'generating', 1)
  on conflict (topic_id) do nothing;
  return v_topic;
end;
$$;

revoke all on function public.claim_next_interactive_lesson_topic(bigint[]) from public, anon, authenticated;
grant execute on function public.claim_next_interactive_lesson_topic(bigint[]) to service_role;
