-- Öğrenci kendi "@ai" sorusunu da silebilsin — question_comments'taki gibi
-- gerçekten silinmiyor, status='deleted' olup yayından kalkıyor (kayıt admin
-- incelemesi için durur). Silinen bir AI cevabına yapılmış yorumlar da
-- (question_comments.parent_ai_answer_id) aynı şekilde yayından kalkar.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.rag_answers'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.rag_answers drop constraint %I', cname);
  end if;
end $$;

alter table public.rag_answers add constraint rag_answers_status_check
  check (status = any (array['pending', 'published', 'rejected', 'deleted']));
