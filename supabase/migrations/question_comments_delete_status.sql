-- Kullanıcı kendi yorumunu "silebilsin" — ama gerçekten silinmiyor, status='deleted'
-- olup yayından kalkıyor. Şikayet/inceleme durumunda admin hâlâ görebilsin diye
-- (ör. hakaret içerikliyse kim yazmış, ne yazmış kaydı kalsın). Bir üst yorum
-- silinirse altındaki yanıtlar da (başkaları yazmış olsa bile) yayından kalkar.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.question_comments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.question_comments drop constraint %I', cname);
  end if;
end $$;

alter table public.question_comments add constraint question_comments_status_check
  check (status = any (array['pending', 'published', 'rejected', 'deleted']));

-- Düzenleme/silme sadece service-role API route'ları (/api/comments/[id]) üzerinden
-- yapılıyor (ownership kontrolü + yanıtlara kademe orada uygulanıyor); bu yüzden
-- ekstra bir UPDATE RLS policy'sine gerek yok — client'ın doğrudan status='published'
-- yazarak moderasyonu atlayabilmesini de böylece engellemiş oluyoruz.
