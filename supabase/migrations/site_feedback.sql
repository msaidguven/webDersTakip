-- Site genel geri bildirim ve iletişim tablosu (öğretmen, öğrenci ve misafir mesajları).
-- Ekleme /api/feedback üzerinden (honeypot + hız sınırı + sunucu taraflı rol/profil zenginleştirmesi),
-- okuma/yönetim /api/admin/feedback üzerinden (service role) yapılır; doğrudan PostgREST erişimi kapalıdır.
-- Dosyanın tamamı tekrar çalıştırılabilir (idempotent).

create table if not exists public.site_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('teacher', 'student', 'guest', 'admin')),
  category text not null check (category in ('like', 'idea', 'curriculum', 'yazili_tool', 'content', 'confusing', 'bug', 'other')),
  area text check (area is null or area in ('soru_bankasi', 'konu_anlatimi', 'yazili_araci', 'mufredat_kazanim', 'tasarim_hiz', 'diger')),
  message text check (message is null or char_length(btrim(message)) between 1 and 2000),
  source text not null check (source in ('teacher_home', 'yazili_builder', 'student_today', 'header_menu', 'contact_page')),
  page_path text check (page_path is null or char_length(page_path) <= 500),
  sender_name text check (sender_name is null or char_length(sender_name) <= 120),
  sender_email text check (sender_email is null or char_length(sender_email) <= 254),
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) < 8192),
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  admin_reply text check (admin_reply is null or char_length(admin_reply) <= 2000),
  replied_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_feedback_status_created on public.site_feedback (status, created_at desc);
create index if not exists idx_site_feedback_role_created on public.site_feedback (role, created_at desc);
create index if not exists idx_site_feedback_created on public.site_feedback (created_at desc);
create index if not exists idx_site_feedback_ip_rate on public.site_feedback (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists idx_site_feedback_user_rate on public.site_feedback (user_id, created_at desc) where user_id is not null;

alter table public.site_feedback enable row level security;
