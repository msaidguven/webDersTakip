-- Admin panelde ünite/konu/alt konu/içerik/kazanım/soru silme işlemleri şimdiye kadar
-- app/src/lib/adminCascade.ts içinde, gerçek bir DB transaction olmadan, birbirinden
-- bağımsız sıralı DELETE çağrılarıyla yapılıyordu. Bu yüzden bir konudaki tek bir soru
-- öğrenci tarafından cevaplanmışsa, o konunun kazanımları/içerikleri zaten silinmiş
-- oluyor ama konu satırının kendisi FK hatasıyla silinemeden kalıyordu (yarım silme).
--
-- Bu migration cascade mantığını veritabanına taşıyor: saf hiyerarşi/link tabloları için
-- ON DELETE CASCADE (öğrenci verisi tablolarına hiç dokunulmuyor, onlar RESTRICT/NO ACTION
-- kalmaya devam ediyor), ve id başına atomik silme sağlayan 6 adet plpgsql fonksiyonu.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

-- 1) FK'ları düzelt: saf hiyerarşi tabloları CASCADE, questions.section_id SET NULL.
-- Mevcut constraint isimleri projede tutarsız (bazıları elle isimlendirilmiş, bazıları
-- otomatik üretilmiş, bazı tablolarda isim/tablo adı bile uyuşmuyor) — bu yüzden ismi
-- tahmin etmek yerine pg_constraint üzerinden gerçek adını buluyoruz.
DO $$
DECLARE
  spec record;
  fk record;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('topics', 'unit_id', 'units', 'id', 'CASCADE', 'topics_unit_id_fkey'),
      ('outcomes', 'topic_id', 'topics', 'id', 'CASCADE', 'outcomes_topic_id_fkey'),
      ('outcome_weeks', 'outcome_id', 'outcomes', 'id', 'CASCADE', 'outcome_weeks_outcome_id_fkey'),
      ('topic_contents', 'topic_id', 'topics', 'id', 'CASCADE', 'topic_contents_topic_id_fkey'),
      ('topic_content_sections', 'topic_content_id', 'topic_contents', 'id', 'CASCADE', 'topic_content_sections_topic_content_id_fkey'),
      ('topic_content_section_outcomes', 'section_id', 'topic_content_sections', 'id', 'CASCADE', 'topic_content_section_outcomes_section_id_fkey'),
      ('topic_content_section_outcomes', 'outcome_id', 'outcomes', 'id', 'CASCADE', 'topic_content_section_outcomes_outcome_id_fkey'),
      ('topic_content_highlights', 'topic_content_id', 'topic_contents', 'id', 'CASCADE', 'topic_content_highlights_topic_content_id_fkey'),
      ('topic_content_tips', 'topic_content_id', 'topic_contents', 'id', 'CASCADE', 'topic_content_tips_topic_content_id_fkey'),
      ('topic_content_weeks', 'topic_content_id', 'topic_contents', 'id', 'CASCADE', 'topic_content_weeks_topic_content_id_fkey'),
      ('topic_content_outcomes', 'topic_content_id', 'topic_contents', 'id', 'CASCADE', 'topic_content_outcomes_topic_content_id_fkey'),
      ('topic_content_outcomes', 'outcome_id', 'outcomes', 'id', 'CASCADE', 'topic_content_outcomes_outcome_id_fkey'),
      ('unit_videos', 'unit_id', 'units', 'id', 'CASCADE', 'unit_videos_unit_id_fkey'),
      ('user_topic_content_progress', 'topic_id', 'topics', 'id', 'CASCADE', 'user_topic_content_progress_topic_id_fkey'),
      ('questions', 'topic_id', 'topics', 'id', 'CASCADE', 'questions_topic_id_fkey'),
      ('questions', 'section_id', 'topic_content_sections', 'id', 'SET NULL', 'questions_section_id_fkey'),
      ('question_choices', 'question_id', 'questions', 'id', 'CASCADE', 'question_choices_question_id_fkey'),
      ('question_classical', 'question_id', 'questions', 'id', 'CASCADE', 'question_classical_question_id_fkey'),
      ('question_blank_options', 'question_id', 'questions', 'id', 'CASCADE', 'question_blank_options_question_id_fkey'),
      ('question_matching_pairs', 'question_id', 'questions', 'id', 'CASCADE', 'question_matching_pairs_question_id_fkey'),
      ('question_usages', 'question_id', 'questions', 'id', 'CASCADE', 'question_usages_question_id_fkey'),
      ('question_outcomes', 'question_id', 'questions', 'id', 'CASCADE', 'question_outcomes_question_id_fkey')
    ) AS t(tbl, col, ref_tbl, ref_col, action, new_name)
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
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
      spec.tbl, spec.new_name, spec.col, spec.ref_tbl, spec.ref_col, spec.action
    );
  END LOOP;
END $$;

-- 2) Id başına atomik cascade-silme fonksiyonları.
-- Her biri p_ids dizisindeki id'leri tek tek dener; plpgsql'in EXCEPTION bloğu o id için
-- otomatik bir savepoint oluşturur, foreign_key_violation (öğrenci verisi engeli) olursa
-- SADECE o id'nin denemesi rollback olur — diğer id'ler ve daha önce başarıyla silinenler
-- etkilenmez. Alt tablo temizliği artık ON DELETE CASCADE ile veritabanı seviyesinde
-- garanti altında, tek satırlık DELETE yeterli.
--
-- SECURITY INVOKER: bu fonksiyonlar sadece admin API route'larından, zaten RLS'i bypass
-- eden SUPABASE_SERVICE_KEY ile çağrılıyor — ekstra yetki yükseltmeye gerek yok.

DROP FUNCTION IF EXISTS admin_delete_units_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_units_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.units WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_units_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_units_cascade(bigint[]) TO service_role;

DROP FUNCTION IF EXISTS admin_delete_topics_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_topics_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.topics WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_topics_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_topics_cascade(bigint[]) TO service_role;

DROP FUNCTION IF EXISTS admin_delete_sections_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_sections_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.topic_content_sections WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_sections_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_sections_cascade(bigint[]) TO service_role;

DROP FUNCTION IF EXISTS admin_delete_contents_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_contents_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.topic_contents WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_contents_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_contents_cascade(bigint[]) TO service_role;

DROP FUNCTION IF EXISTS admin_delete_outcomes_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_outcomes_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.outcomes WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_outcomes_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_outcomes_cascade(bigint[]) TO service_role;

DROP FUNCTION IF EXISTS admin_delete_questions_cascade(bigint[]);
CREATE OR REPLACE FUNCTION admin_delete_questions_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      DELETE FROM public.questions WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      item_id := v_id; success := false; reason := SQLERRM; RETURN NEXT;
    END;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_delete_questions_cascade(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_questions_cascade(bigint[]) TO service_role;
