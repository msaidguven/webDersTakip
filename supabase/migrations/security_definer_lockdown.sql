-- Güvenlik turu (2026-10-25): SECURITY DEFINER fonksiyonların RLS'yi atlayan herkese açık çağrısı kapatılır.
--
-- Bulgu: Postgres yeni fonksiyonlara EXECUTE'u PUBLIC'e, Supabase varsayılanı ayrıca anon/authenticated'a
-- verir. Yetki kontrolü içermeyen yönetici/worker fonksiyonları (admin_force_delete_*_cascade, soru/ünite
-- oluşturma, AI içerik temizleme…) herkese açık anon anahtarıyla /rest/v1/rpc/... üzerinden çağrılabiliyordu
-- (count_topics_missing_highlights ile salt okunur doğrulandı: 200).
--
-- 1) Uygulamanın yalnız servis anahtarıyla çağırdığı fonksiyonlar → yalnız service_role.
-- 2) Uygulamada hiç çağrılmayan (emekli mobil uygulamadan kalan) fonksiyonlar → yalnız service_role.
--    Silinmedi; bunları çağıran definer fonksiyonlar ve tetikleyiciler sahibin (postgres) yetkisiyle çalışır,
--    EXECUTE gerekmez (2026-10-25 geri alınan işlemle doğrulandı).
-- 3) search_path sabitlenmemiş definer fonksiyonlara search_path (signup pgcrypto'yu şemasız kullanıyor).
-- 4) anon/authenticated TRUNCATE yetkisi (RLS'yi atlar) kaldırılır.
-- 5) Varsayılanlar: yeni fonksiyonlar PUBLIC/anon/authenticated'a EXECUTE ile, yeni tablolar TRUNCATE ile
--    gelmez. YENİ kullanıcı RPC'si yazan migration'lar açıkça `grant execute on function … to authenticated`
--    (gerekirse anon) eklemeli. CREATE OR REPLACE mevcut yetkileri korur; DROP + CREATE korumaz.
--
-- Dokunulmayanlar: kullanıcı oturumu/anon istemciyle çağrılan ve kendi auth.uid() kontrolünü yapan RPC'ler
-- (start_web_quiz_session, submit_test_answers, get_my_*, get_public_*, track_page_view…) ve RLS
-- politikalarında kullanılanlar (is_admin, is_admin_or_teacher, takdir_geri_bildirim_hiz_ok).

-- 1) Uygulama servis anahtarıyla çağırıyor
revoke execute on function public.admin_force_delete_questions_cascade(bigint[]) from public, anon, authenticated;
revoke execute on function public.admin_force_delete_topics_cascade(bigint[]) from public, anon, authenticated;
revoke execute on function public.admin_force_delete_units_cascade(bigint[]) from public, anon, authenticated;
revoke execute on function public.count_topics_missing_highlights() from public, anon, authenticated;
revoke execute on function public.find_next_ai_content_draft_topic() from public, anon, authenticated;
revoke execute on function public.find_next_topic_missing_highlights() from public, anon, authenticated;
revoke execute on function public.notify_due_srs_reviews() from public, anon, authenticated;
revoke execute on function public.web_check_auth_rate_limit(text) from public, anon, authenticated;
revoke execute on function public.web_record_auth_attempt(text,text,boolean) from public, anon, authenticated;

-- 2) Uygulamada kullanılmıyor
revoke execute on function public.add_weekly_curriculum(bigint,bigint,jsonb,jsonb,integer,text[],text) from public, anon, authenticated;
revoke execute on function public.admin_delete_cwqc_for_units(bigint[]) from public, anon, authenticated;
revoke execute on function public.admin_delete_units(bigint[]) from public, anon, authenticated;
revoke execute on function public.admin_purge_ai_content_for_topics(bigint[]) from public, anon, authenticated;
revoke execute on function public.admin_purge_ai_content_for_units(bigint[]) from public, anon, authenticated;
revoke execute on function public.auto_complete_web_quiz_session() from public, anon, authenticated;
revoke execute on function public.build_user_curriculum_week_run_summary_for_test(bigint) from public, anon, authenticated;
revoke execute on function public.build_user_curriculum_week_seen_questions_for_test(bigint) from public, anon, authenticated;
revoke execute on function public.bulk_create_questions(bigint,text,jsonb,integer) from public, anon, authenticated;
revoke execute on function public.bulk_create_questions(bigint,text,jsonb,integer,integer,integer,bigint[]) from public, anon, authenticated;
revoke execute on function public.bulk_create_questions(bigint,text,jsonb,integer,bigint[]) from public, anon, authenticated;
revoke execute on function public.clone_unit_to_grade(bigint,bigint,text) from public, anon, authenticated;
revoke execute on function public.create_true_false_question(text,boolean,smallint,smallint) from public, anon, authenticated;
revoke execute on function public.finish_practice_session(bigint) from public, anon, authenticated;
revoke execute on function public.fix_true_false_question(bigint,boolean) from public, anon, authenticated;
revoke execute on function public.get_active_grades() from public, anon, authenticated;
revoke execute on function public.get_active_question_v2(bigint) from public, anon, authenticated;
revoke execute on function public.get_ai_topic_highlights_worker_runs(integer) from public, anon, authenticated;
revoke execute on function public.get_lessons_by_grade(bigint) from public, anon, authenticated;
revoke execute on function public.get_lessons_for_grade(bigint) from public, anon, authenticated;
revoke execute on function public.get_next_practice_questions(bigint,smallint,integer) from public, anon, authenticated;
revoke execute on function public.get_next_practice_questions(bigint,integer,integer) from public, anon, authenticated;
revoke execute on function public.get_next_practice_questions(bigint,smallint,integer,integer) from public, anon, authenticated;
revoke execute on function public.get_next_question_v3(bigint,uuid) from public, anon, authenticated;
revoke execute on function public.get_next_question_v3(bigint) from public, anon, authenticated;
revoke execute on function public.get_outcome_scope_stats_v2(uuid,bigint,integer,bigint[],bigint[]) from public, anon, authenticated;
revoke execute on function public.get_practice_questions(uuid,bigint,smallint) from public, anon, authenticated;
revoke execute on function public.get_practice_test_report(uuid,bigint) from public, anon, authenticated;
revoke execute on function public.get_question_count_for_topic(integer,integer,integer) from public, anon, authenticated;
revoke execute on function public.get_questions_for_weekly_test(bigint,integer,integer,integer) from public, anon, authenticated;
revoke execute on function public.get_srs_due_count(uuid,bigint) from public, anon, authenticated;
revoke execute on function public.get_topics_with_contents(bigint) from public, anon, authenticated;
revoke execute on function public.get_unit_details(bigint) from public, anon, authenticated;
revoke execute on function public.get_unit_summary(uuid,bigint,uuid) from public, anon, authenticated;
revoke execute on function public.get_unit_summary(uuid,bigint) from public, anon, authenticated;
revoke execute on function public.get_units_for_grade_and_lesson(bigint,bigint) from public, anon, authenticated;
revoke execute on function public.get_units_for_lesson_and_grade(bigint,bigint) from public, anon, authenticated;
revoke execute on function public.get_user_stats_by_period(uuid,text) from public, anon, authenticated;
revoke execute on function public.get_week_view_web(bigint,bigint,integer) from public, anon, authenticated;
revoke execute on function public.process_test_completion(bigint) from public, anon, authenticated;
revoke execute on function public.process_test_completion_trigger() from public, anon, authenticated;
revoke execute on function public.reset_lesson_grade_tymm_verified() from public, anon, authenticated;
revoke execute on function public.set_practice_user_id() from public, anon, authenticated;
revoke execute on function public.signup(text,text,text,text,text,date,text) from public, anon, authenticated;
revoke execute on function public.start_guest_test(bigint,text,integer) from public, anon, authenticated;
revoke execute on function public.start_guest_test_by_outcomes(bigint,bigint,integer,bigint[],integer) from public, anon, authenticated;
revoke execute on function public.sync_curriculum_week_question_count(bigint,integer) from public, anon, authenticated;
revoke execute on function public.sync_user_question_stats_on_answer() from public, anon, authenticated;
revoke execute on function public.transactional_create_unit(text,bigint,bigint) from public, anon, authenticated;
revoke execute on function public.transactional_update_unit(bigint,text,bigint,bigint) from public, anon, authenticated;

-- 3) search_path
alter function public.add_weekly_curriculum(bigint,bigint,jsonb,jsonb,integer,text[],text) set search_path = public;
alter function public.build_user_curriculum_week_run_summary_for_test(bigint) set search_path = public;
alter function public.build_user_curriculum_week_seen_questions_for_test(bigint) set search_path = public;
alter function public.bulk_create_questions(bigint,text,jsonb,integer,bigint[]) set search_path = public;
alter function public.bulk_create_questions(bigint,text,jsonb,integer,integer,integer,bigint[]) set search_path = public;
alter function public.bulk_create_questions(bigint,text,jsonb,integer) set search_path = public;
alter function public.clone_unit_to_grade(bigint,bigint,text) set search_path = public;
alter function public.create_test_session_and_get_questions(bigint,integer,integer,integer) set search_path = public;
alter function public.create_true_false_question(text,boolean,smallint,smallint) set search_path = public;
alter function public.finish_practice_session(bigint) set search_path = public;
alter function public.fix_true_false_question(bigint,boolean) set search_path = public;
alter function public.get_active_grades() set search_path = public;
alter function public.get_lessons_by_grade(bigint) set search_path = public;
alter function public.get_lessons_for_grade(bigint) set search_path = public;
alter function public.get_next_practice_questions(bigint,integer,integer) set search_path = public;
alter function public.get_next_practice_questions(bigint,smallint,integer,integer) set search_path = public;
alter function public.get_next_practice_questions(bigint,smallint,integer) set search_path = public;
alter function public.get_outcome_scope_stats_v2(uuid,bigint,integer,bigint[],bigint[]) set search_path = public;
alter function public.get_question_count_for_topic(integer,integer,integer) set search_path = public;
alter function public.get_questions_for_weekly_test(bigint,integer,integer,integer) set search_path = public;
alter function public.get_srs_due_count(uuid,bigint) set search_path = public;
alter function public.get_unit_details(bigint) set search_path = public;
alter function public.get_units_for_grade_and_lesson(bigint,bigint) set search_path = public;
alter function public.get_units_for_lesson_and_grade(bigint,bigint) set search_path = public;
alter function public.get_week_view_web(bigint,bigint,integer) set search_path = public;
alter function public.process_test_completion_trigger() set search_path = public;
alter function public.process_test_completion(bigint) set search_path = public;
alter function public.set_practice_user_id() set search_path = public;
alter function public.signup(text,text,text,text,text,date,text) set search_path = public, extensions;
alter function public.start_guest_test_by_outcomes(bigint,bigint,integer,bigint[],integer) set search_path = public;
alter function public.start_guest_test(bigint,text,integer) set search_path = public;
alter function public.start_srs_test_session(uuid,bigint,uuid,integer) set search_path = public;
alter function public.start_unit_test(uuid,bigint,uuid) set search_path = public;
alter function public.start_weekly_test_session_by_outcomes(uuid,bigint,bigint,integer,bigint[],uuid,integer) set search_path = public;
alter function public.start_weekly_test_session(uuid,bigint,integer,uuid) set search_path = public;
alter function public.sync_curriculum_week_question_count(bigint,integer) set search_path = public;
alter function public.sync_user_question_stats() set search_path = public;
alter function public.transactional_create_unit(text,bigint,bigint) set search_path = public;
alter function public.transactional_update_unit(bigint,text,bigint,bigint) set search_path = public;
alter function public.web_get_active_grades() set search_path = public;
alter function public.web_get_lessons_for_grade(bigint) set search_path = public;

-- 4) TRUNCATE
revoke truncate on all tables in schema public from anon, authenticated;

-- 5) Varsayılan yetkiler (postgres'in oluşturduğu nesneler; Supabase CLI/panel/Management API bu rolle çalışır)
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
