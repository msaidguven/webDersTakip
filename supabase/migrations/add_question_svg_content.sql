-- Sorulara opsiyonel SVG görsel içeriği eklemek için (özellikle matematik/geometri soruları).
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS svg_content text;
