-- Test sayfasındaki "AI'ye Sor" kutusu ve yorumlar tek bir kutuya/akışa birleşiyor:
-- öğrenci normal bir şey yazarsa yorum olur (admin onayına düşer), "@ai" yazarsa
-- AI'ye soru olarak gider (ayrı, zaten var olan rag_answers akışı — bu tabloya
-- dokunmuyor, sadece ekranda ikisi birlikte gösteriliyor). Bu yüzden ders
-- sayfasında da (bir test sorusuna değil, doğrudan bir üniteye) yorum
-- yapılabilmesi için question_comments artık unit_id ile de çalışabilmeli.
alter table public.question_comments alter column question_id drop not null;
alter table public.question_comments add column if not exists unit_id bigint references public.units(id);

alter table public.question_comments drop constraint if exists question_comments_scope_check;
alter table public.question_comments add constraint question_comments_scope_check check (
  (question_id is not null and unit_id is null) or (question_id is null and unit_id is not null)
);

create index if not exists idx_question_comments_unit_id on public.question_comments(unit_id);
