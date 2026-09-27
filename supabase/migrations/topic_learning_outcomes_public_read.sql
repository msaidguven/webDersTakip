-- topic_learning_outcomes tablosunda RLS açık ama SELECT policy'si yok — herkese açık konu
-- sayfaları (anon client) öğrenme çıktısının kodunu/başlığını okuyamıyor, outcomes'tan
-- yapılan embed null dönüyor. v2 konu sayfası kazanımları artık öğrenme çıktısına göre
-- gruplayıp (ör. "MAT.6.1.3 …" altında a, b, c) gösterdiği için okunabilmesi gerekiyor
-- (kullanıcı isteği, 2026-09-27).
--
-- İçerik MEB müfredatının kendisi (kod + başlık), hassas değil — herkese SELECT açmak
-- güvenli. Yazma hâlâ sadece admin API'leri + service-role client üzerinden; bu policy
-- INSERT/UPDATE/DELETE'e dokunmuyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.topic_learning_outcomes enable row level security;

drop policy if exists "topic_learning_outcomes_public_read" on public.topic_learning_outcomes;

create policy "topic_learning_outcomes_public_read"
  on public.topic_learning_outcomes
  for select
  to anon, authenticated
  using (true);
