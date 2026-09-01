-- user_topic_content_progress su ana kadar hic kullanilmiyordu (bkz.
-- docs/site-iyilestirme-plani.md madde 2), bu yuzden auth.uid()=user_id
-- baz alan "kendi satirina" RLS politikalari hic tanimlanmamisti. Panelde
-- "Devam Edilen Konular" ve konu anlatimi sayfasindaki "Konuyu Bitirdim"
-- butonu bu tabloya yazip okuyacak; test_sessions/test_session_answers
-- icin daha once kurulmus olan "own row" desenini (bkz.
-- drop_overly_permissive_test_session_policies.sql) burada da uyguluyoruz.

ALTER TABLE public.user_topic_content_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utcp_own_select" ON public.user_topic_content_progress;
CREATE POLICY "utcp_own_select" ON public.user_topic_content_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "utcp_own_insert" ON public.user_topic_content_progress;
CREATE POLICY "utcp_own_insert" ON public.user_topic_content_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "utcp_own_update" ON public.user_topic_content_progress;
CREATE POLICY "utcp_own_update" ON public.user_topic_content_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_topic_content_progress TO authenticated;
