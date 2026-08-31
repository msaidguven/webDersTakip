-- @hocam/@kanka ile bir yoruma ya da başka bir AI cevabına "yanıt" olarak soru
-- sorulduğunda, bu artık bağımsız üst-seviye bir kayıt değil, o yorumun/cevabın
-- ALTINA nested bir yanıt olarak saklanmalı — hem görüntülemede doğru gruplansın
-- hem de üretim sırasında yanıt verilen mesajın içeriği bağlam olarak kullanılabilsin.
alter table public.rag_answers
  add column if not exists parent_comment_id bigint references public.question_comments(id) on delete cascade,
  add column if not exists parent_rag_answer_id bigint references public.rag_answers(id) on delete cascade;

alter table public.rag_answers drop constraint if exists rag_answers_parent_check;
alter table public.rag_answers add constraint rag_answers_parent_check check (
  parent_comment_id is null or parent_rag_answer_id is null
);

create index if not exists idx_rag_answers_parent_comment on public.rag_answers(parent_comment_id);
create index if not exists idx_rag_answers_parent_rag_answer on public.rag_answers(parent_rag_answer_id);
