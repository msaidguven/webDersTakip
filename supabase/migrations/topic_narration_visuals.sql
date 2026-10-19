-- Sesli anlatım (oynatıcı) görselleri: anahtar kavram → görsel URL. Oynatıcı, anlatılan ekranın metninde
-- bu terim geçiyorsa görseli o ekranda gösterir. Görseller dışarıdan (AI üretimi ya da elle yüklenmiş URL)
-- gelir; bu tabloda yalnızca URL tutulur. Herkes okur (konu içeriği), yazma yalnızca service role.
create table if not exists public.topic_narration_visuals (
  topic_id bigint not null references public.topics(id) on delete cascade,
  term text not null check (char_length(term) between 1 and 120),
  image_url text not null check (image_url ~ '^https://'),
  created_at timestamptz not null default now(),
  primary key (topic_id, term)
);

alter table public.topic_narration_visuals enable row level security;
drop policy if exists topic_narration_visuals_public_read on public.topic_narration_visuals;
create policy topic_narration_visuals_public_read on public.topic_narration_visuals for select to anon, authenticated using (true);
grant select on public.topic_narration_visuals to anon, authenticated;
