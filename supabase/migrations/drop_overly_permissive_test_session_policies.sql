-- Remove leftover dev/debug RLS policies that granted PUBLIC (anon + authenticated)
-- full read/write/delete access to test_sessions and test_session_answers via
-- USING (true). These are permissive policies, so they OR'd with (and fully
-- overrode) the correct "own row only" policies already present on both
-- tables — meaning anyone with just the public anon key could read every
-- student's test history/answers, or write/delete rows for other users.
--
-- Dropping them is safe: the legitimate "own row" policies
-- (e.g. test_sessions_own_select/insert/update, tsa_own_select/insert/update)
-- already cover all real access patterns, and the SECURITY DEFINER RPCs
-- (start_unit_test, finish_test_session, etc.) bypass RLS entirely.

DROP POLICY IF EXISTS "Allow all for test_sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "Allow all for test_session_answers" ON public.test_session_answers;
