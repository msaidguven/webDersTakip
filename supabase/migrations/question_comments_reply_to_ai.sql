-- Öğrenciler artık bir AI cevabının altına da yorum/yanıt yazabilir (kendi
-- aralarında ya da tekrar "@ai" ile). AI cevapları rag_answers'ta durduğu için,
-- question_comments'a bir rag_answers satırına yanıt olduğunu belirten ayrı bir
-- parent kolonu ekliyoruz — parent_comment_id (bir yoruma yanıt) ile karışmasın.
alter table public.question_comments
  add column if not exists parent_ai_answer_id bigint references public.rag_answers(id) on delete cascade;

alter table public.question_comments drop constraint if exists question_comments_parent_check;
alter table public.question_comments add constraint question_comments_parent_check check (
  parent_comment_id is null or parent_ai_answer_id is null
);

create index if not exists idx_question_comments_parent_ai_answer on public.question_comments(parent_ai_answer_id);
