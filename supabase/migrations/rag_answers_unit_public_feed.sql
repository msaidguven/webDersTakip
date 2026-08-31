-- Ders notu soru-cevabı artık ünite bazında, herkese açık bir "yorum" akışı gibi
-- gösterilecek: bir ünitede sorulan sorular sadece o ünite sayfasında görünsün,
-- başka ünitede görünmesin; ve herkes herkesin sorduğu soruyu görebilsin (arama
-- hâlâ tüm kitap — grade_id+lesson_id — kapsamında yapılıyor, bu sadece görüntüleme
-- gruplaması). Kişisel/özel sohbet ayrı bir özellik olarak düşünüldüğü için bu akış
-- bilerek herkese açık.
alter table public.rag_answers add column if not exists unit_id bigint references public.units(id);

create index if not exists idx_rag_answers_unit_id on public.rag_answers(unit_id);
