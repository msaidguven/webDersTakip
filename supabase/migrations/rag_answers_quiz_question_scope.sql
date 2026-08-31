-- Test sayfasındaki "AI'ye Sor" (neden A vb.) artık sadece o spesifik soruya
-- özel gösteriliyor (question_comments ile aynı mantık), ünitedeki diğer
-- soruların Q&A'larıyla karışmasın diye. Ders sayfasındaki genel soru-cevap ise
-- hâlâ ünite bazında (bkz. rag_answers.unit_id, bir önceki migration).
alter table public.rag_answers add column if not exists quiz_question_id bigint references public.questions(id);

create index if not exists idx_rag_answers_quiz_question_id on public.rag_answers(quiz_question_id);
