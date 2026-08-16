-- Bir sorunun hangi konuya (ve varsa hangi alt başlığa) ait olduğunu ve kaynağını
-- (manuel mi, AI ise hangi model) doğrudan questions üzerinde tutmak için.
-- topic_id her zaman zorunlu tutulacak (ünite/ders/sınıf buradan join ile çıkar);
-- section_id nullable — doluysa soru o alt başlığa özel, boşsa konunun geneline ait
-- sayılır (ünite testinde yine de gösterilir). Kazanım (outcome) ilişkisi ayrı
-- (question_outcomes) ve sadece etiketleme/raporlama amaçlı kalmaya devam eder;
-- hiyerarşi hiçbir zaman kazanımdan çıkarılmaz.
alter table public.questions
  add column if not exists topic_id bigint references public.topics(id);
alter table public.questions
  add column if not exists section_id bigint references public.topic_content_sections(id);
alter table public.questions
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'ai_generated'));
alter table public.questions
  add column if not exists ai_model text;
