-- Genel amaçlı bildirim tablosu — ilk kullanıcısı: AI (@hocam/@kanka) sorusu
-- cevaplandığında öğrenciye "cevabın hazır" bildirimi göndermek (bkz.
-- app/api/rag/process-queue/route.ts, rag_question_queue). type alanı ileride
-- başka bildirim türleri (ör. yorum yanıtı) eklenebilsin diye var, ama şimdilik
-- sadece 'rag_answer' üretiliyor — spekülatif bir tür listesi kurulmadı.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- Bildirimler tamamen "kendine özel" (bir başkasınınkini görmek/değiştirmek anlamsız),
-- bu yüzden okuma, "okundu" işaretleme ve silme doğrudan client'tan RLS ile
-- yapılıyor — bunlar için ayrı bir API route'una gerek yok. Oluşturma (insert)
-- SADECE worker'ın (service role, RLS bypass) işi — öğrenci kendine/başkasına
-- sahte bildirim ekleyemesin diye burada bilerek bir insert policy'si YOK.
drop policy if exists "notifications_own_read" on public.notifications;
create policy "notifications_own_read" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_own_mark_read" on public.notifications;
create policy "notifications_own_mark_read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kullanıcı isteği (2026-09-04): kendi bildirimini silebilsin. Denetim/moderasyon
-- gereken bir kayıt değil (comments'teki soft-delete deseninin aksine), o yüzden
-- gerçek DELETE burada güvenli.
drop policy if exists "notifications_own_delete" on public.notifications;
create policy "notifications_own_delete" on public.notifications
  for delete using (auth.uid() = user_id);
