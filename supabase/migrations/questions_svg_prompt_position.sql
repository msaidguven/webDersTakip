-- Soru üretme promptları artık (gerekirse) her soru için ayrı bir "SVG çizim promptu"
-- üretebiliyor; bu prompt daha sonra admin tarafından başka bir AI'ye verilip dönen SVG
-- svg_content'e elle yapıştırılıyor. svg_prompt bu ara promptu saklar, svg_position ise
-- SVG'nin soru kökünün üstünde mi altında mı gösterileceğini belirler (AI karar verir).
ALTER TABLE public.questions
  ADD COLUMN svg_prompt text,
  ADD COLUMN svg_position text NOT NULL DEFAULT 'above' CHECK (svg_position IN ('above', 'below'));
