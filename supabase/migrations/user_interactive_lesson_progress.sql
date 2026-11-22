-- Etkileşimli ders (v3) öğrenci bazlı kalıcı ilerleme ve tekrar tamamlama sayacı.
-- Öğrencinin hangi bölümde kaldığı, hangi bölümleri bitirdiği ve bu dersi toplam
-- kaç kez tamamladığı (sıfırlayıp yeniden çalışsa bile korunan completion_count)
-- burada saklanır. Tüm bölümler bitirildiğinde ayrıca user_topic_content_progress
-- tablosu da güncellenerek öğrenci konuyu çalışmış sayılır.

CREATE TABLE IF NOT EXISTS public.user_interactive_lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  completed_sections integer[] NOT NULL DEFAULT '{}'::integer[],
  solved_gates text[] NOT NULL DEFAULT '{}'::text[],
  section_progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_section_idx integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0 CHECK (completion_count >= 0),
  current_run_counted boolean NOT NULL DEFAULT false,
  first_completed_at timestamptz,
  last_completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_interactive_lesson_progress_pkey PRIMARY KEY (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS uilp_user_updated_idx
  ON public.user_interactive_lesson_progress (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS uilp_topic_completed_idx
  ON public.user_interactive_lesson_progress (topic_id)
  WHERE completion_count > 0;

ALTER TABLE public.user_interactive_lesson_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uilp_own_select" ON public.user_interactive_lesson_progress;
CREATE POLICY "uilp_own_select" ON public.user_interactive_lesson_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "uilp_own_insert" ON public.user_interactive_lesson_progress;
CREATE POLICY "uilp_own_insert" ON public.user_interactive_lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "uilp_own_update" ON public.user_interactive_lesson_progress;
CREATE POLICY "uilp_own_update" ON public.user_interactive_lesson_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_interactive_lesson_progress TO authenticated;
