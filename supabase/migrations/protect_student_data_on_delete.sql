-- admin_cascade_delete.sql migration'ından sonra canlı veritabanında information_schema
-- sorgusuyla kontrol edildi: test_session_answers, test_session_questions, test_sessions,
-- user_question_stats, user_curriculum_week_seen_questions, user_unit_seen_questions,
-- user_curriculum_week_run_summary, user_unit_summary, user_weekly_summary tablolarındaki
-- question_id/unit_id FK'ları zaten ON DELETE CASCADE imiş (supabase/db_schemas.sql dump'ı
-- bunu yanlış/eski gösteriyordu). Yani admin panelden bir soru/ünite silindiğinde, o soruyu
-- cevaplamış öğrencilerin test geçmişi/istatistikleri hiçbir uyarı olmadan sessizce
-- siliniyordu — uygulamadaki "öğrenci geçmişinde kullanılmış, silinemiyor" koruması DB
-- seviyesinde hiç var olmamış.
--
-- Bu migration bu tabloları NO ACTION'a (RESTRICT) çeviriyor: artık gerçekten cevaplanmış
-- bir soru/ünite silinmeye çalışılırsa admin_delete_*_cascade fonksiyonları bunu
-- foreign_key_violation olarak yakalayıp okunabilir bir Türkçe hata döndürecek, hiçbir şey
-- silinmeyecek.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın (admin_cascade_delete.sql'den SONRA).

DO $$
DECLARE
  spec record;
  fk record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('test_session_answers', 'question_id', 'questions', 'id', 'test_session_answers_question_id_fkey'),
      ('test_session_questions', 'question_id', 'questions', 'id', 'test_session_questions_question_id_fkey'),
      ('test_sessions', 'unit_id', 'units', 'id', 'test_sessions_unit_id_fkey'),
      ('user_question_stats', 'question_id', 'questions', 'id', 'user_question_stats_question_id_fkey'),
      ('user_curriculum_week_seen_questions', 'question_id', 'questions', 'id', 'user_curriculum_week_seen_questions_question_id_fkey'),
      ('user_curriculum_week_seen_questions', 'unit_id', 'units', 'id', 'user_curriculum_week_seen_questions_unit_id_fkey'),
      ('user_unit_seen_questions', 'question_id', 'questions', 'id', 'user_unit_seen_questions_question_id_fkey'),
      ('user_unit_seen_questions', 'unit_id', 'units', 'id', 'user_unit_seen_questions_unit_id_fkey'),
      ('user_curriculum_week_run_summary', 'unit_id', 'units', 'id', 'user_curriculum_week_run_summary_unit_id_fkey'),
      ('user_unit_summary', 'unit_id', 'units', 'id', 'user_unit_summary_unit_id_fkey'),
      ('user_weekly_summary', 'unit_id', 'units', 'id', 'user_weekly_summary_unit_id_fkey')
    ) AS t(tbl, col, ref_tbl, ref_col, new_name)
  LOOP
    FOR fk IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.conrelid = format('public.%I', spec.tbl)::regclass
        AND con.contype = 'f'
        AND att.attname = spec.col
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, fk.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE NO ACTION',
      spec.tbl, spec.new_name, spec.col, spec.ref_tbl, spec.ref_col
    );
  END LOOP;
END $$;
