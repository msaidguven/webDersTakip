-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.grades (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  order_no integer NOT NULL DEFAULT 0 UNIQUE CHECK (order_no >= 0),
  is_active boolean NOT NULL DEFAULT true,
  icon text,
  slug text UNIQUE,
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lessons (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  icon text,
  description text,
  order_no integer DEFAULT 0 UNIQUE CHECK (order_no >= 0),
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  slug text UNIQUE,
  CONSTRAINT lessons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lesson_grades (
  lesson_id bigint NOT NULL,
  grade_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  weekly_hours integer CHECK (weekly_hours IS NULL OR weekly_hours >= 1),
  CONSTRAINT lesson_grades_pkey PRIMARY KEY (lesson_id, grade_id),
  CONSTRAINT fk_lg_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT fk_lg_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.units (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  lesson_id bigint NOT NULL,
  title text NOT NULL,
  description text,
  order_no integer NOT NULL DEFAULT 0 CHECK (order_no >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  slug text,
  grade_id bigint NOT NULL,
  start_week integer CHECK (start_week IS NULL OR start_week >= 1),
  end_week integer CHECK (end_week IS NULL OR end_week >= 1),
  curriculum_code text,
  duration_hours integer CHECK (duration_hours IS NULL OR duration_hours >= 1),
  key_concepts ARRAY,
  CONSTRAINT units_pkey PRIMARY KEY (id),
  CONSTRAINT fk_units_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT fk_units_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id)
);
CREATE TABLE public.topics (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit_id bigint NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  order_no integer NOT NULL DEFAULT 0 CHECK (order_no >= 0),
  is_active boolean NOT NULL DEFAULT true,
  order_status text NOT NULL DEFAULT 'approved'::text CHECK (order_status = ANY (ARRAY['approved'::text, 'pending'::text, 'rejected'::text])),
  pending_order_no integer,
  created_at timestamp with time zone DEFAULT now(),
  icon text,
  subtitle text,
  curriculum_code text,
  learning_outcome text,
  CONSTRAINT topics_pkey PRIMARY KEY (id),
  CONSTRAINT topics_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.outcomes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_id bigint NOT NULL,
  description text NOT NULL,
  order_index integer CHECK (order_index >= 0),
  code text,
  curriculum_year text,
  CONSTRAINT outcomes_pkey PRIMARY KEY (id),
  CONSTRAINT outcomes_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id)
);
CREATE TABLE public.topic_contents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_id bigint NOT NULL,
  title text NOT NULL,
  body_markdown text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  is_published boolean NOT NULL DEFAULT false,
  hero_image_url text,
  subtitle text,
  version_no integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual'::text CHECK (source = ANY (ARRAY['manual'::text, 'ai_generated'::text])),
  generation_meta jsonb,
  CONSTRAINT topic_contents_pkey PRIMARY KEY (id),
  CONSTRAINT topic_contents_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id)
);
CREATE TABLE public.unit_videos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text,
  video_url text NOT NULL,
  order_no integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  unit_id bigint NOT NULL,
  CONSTRAINT unit_videos_pkey PRIMARY KEY (id),
  CONSTRAINT unit_videos_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  username text UNIQUE,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])),
  birth_date date,
  about text,
  role text DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text])),
  updated_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  cover_photo_url text,
  grade_id bigint,
  school_name text,
  branch text,
  is_verified boolean DEFAULT false,
  title text,
  city_id integer,
  district_id bigint,
  school_id bigint,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT fk_profiles_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT fk_profiles_city FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT fk_profiles_district FOREIGN KEY (district_id) REFERENCES public.districts(id),
  CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.question_types (
  id smallint NOT NULL,
  code text NOT NULL UNIQUE,
  CONSTRAINT question_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_type_id smallint NOT NULL,
  question_text text NOT NULL,
  difficulty smallint DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  score smallint DEFAULT 1 CHECK (score >= 1 AND score <= 10),
  created_at timestamp without time zone DEFAULT now(),
  solution_text text,
  topic_id bigint,
  section_id bigint,
  source text NOT NULL DEFAULT 'manual'::text CHECK (source = ANY (ARRAY['manual'::text, 'ai_generated'::text])),
  ai_model text,
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_question_type_id_fkey FOREIGN KEY (question_type_id) REFERENCES public.question_types(id),
  CONSTRAINT questions_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.topic_content_sections(id)
);
CREATE TABLE public.question_choices (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  choice_text text NOT NULL,
  is_correct boolean DEFAULT false,
  CONSTRAINT question_choices_pkey PRIMARY KEY (id),
  CONSTRAINT question_choices_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_classical (
  question_id bigint NOT NULL,
  model_answer text,
  answer_words ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT question_classical_pkey PRIMARY KEY (question_id),
  CONSTRAINT question_classical_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_usages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  usage_type text NOT NULL CHECK (usage_type = ANY (ARRAY['weekly'::text, 'topic_end'::text])),
  created_at timestamp with time zone DEFAULT now(),
  order_no integer NOT NULL DEFAULT 0,
  curriculum_week integer,
  CONSTRAINT question_usages_pkey PRIMARY KEY (id),
  CONSTRAINT fk_qu_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT question_usages_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_matching_pairs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  left_text text NOT NULL,
  right_text text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  CONSTRAINT question_matching_pairs_pkey PRIMARY KEY (id),
  CONSTRAINT question_matching_pairs_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_blank_options (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  order_no integer NOT NULL DEFAULT 0 CHECK (order_no >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT question_blank_options_pkey PRIMARY KEY (id),
  CONSTRAINT question_blank_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.cities (
  id integer NOT NULL,
  name text NOT NULL UNIQUE,
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.districts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  city_id integer NOT NULL,
  CONSTRAINT districts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_districts_city FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
CREATE TABLE public.test_session_answers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  test_session_id bigint NOT NULL,
  question_id bigint NOT NULL,
  user_id uuid,
  selected_option_id bigint,
  user_answer_text text,
  is_correct boolean NOT NULL,
  duration_seconds integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  client_id uuid,
  answer_text text,
  recorded_in_stats boolean DEFAULT false,
  CONSTRAINT test_session_answers_pkey PRIMARY KEY (id),
  CONSTRAINT test_session_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT test_session_answers_test_session_id_fkey FOREIGN KEY (test_session_id) REFERENCES public.test_sessions(id),
  CONSTRAINT test_session_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.test_session_questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  test_session_id bigint NOT NULL,
  question_id bigint NOT NULL,
  order_no integer NOT NULL CHECK (order_no >= 1 AND order_no <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT test_session_questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tsq_test_session FOREIGN KEY (test_session_id) REFERENCES public.test_sessions(id),
  CONSTRAINT test_session_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.test_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid,
  unit_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  settings jsonb,
  question_ids ARRAY,
  client_id uuid NOT NULL,
  lesson_id bigint,
  grade_id bigint,
  CONSTRAINT test_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT test_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_test_sessions_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT fk_test_sessions_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT test_sessions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.user_question_stats (
  user_id uuid NOT NULL,
  question_id bigint NOT NULL,
  last_answer_correct boolean,
  last_answer_at timestamp with time zone,
  total_attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  correct_attempts integer NOT NULL DEFAULT 0,
  wrong_attempts integer NOT NULL DEFAULT 0,
  next_review_at timestamp with time zone,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  is_mastered boolean DEFAULT false,
  mastered_at timestamp with time zone,
  grade_id bigint,
  CONSTRAINT user_question_stats_pkey PRIMARY KEY (user_id, question_id),
  CONSTRAINT fk_user_question_stats_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT user_question_stats_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_question_stats_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.number_compare_questions (
  id integer NOT NULL DEFAULT nextval('number_compare_questions_id_seq'::regclass),
  question_speech character varying NOT NULL,
  left_display character varying NOT NULL,
  left_speech character varying NOT NULL,
  right_display character varying NOT NULL,
  right_speech character varying NOT NULL,
  correct_side character varying NOT NULL CHECK (correct_side::text = ANY (ARRAY['left'::character varying, 'right'::character varying]::text[])),
  level smallint NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT number_compare_questions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.number_composition_questions (
  id integer NOT NULL DEFAULT nextval('number_composition_questions_id_seq'::regclass),
  question_speech character varying NOT NULL,
  correct_answer character varying NOT NULL,
  level smallint NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  digits_count smallint,
  min_digit smallint DEFAULT 0,
  max_digit smallint DEFAULT 9,
  CONSTRAINT number_composition_questions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_time_based_stats (
  user_id uuid NOT NULL,
  period_type text NOT NULL CHECK (period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'academic_year'::text])),
  period_date date NOT NULL,
  period_value text NOT NULL,
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  total_duration_seconds integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  wrong_answers integer NOT NULL DEFAULT 0,
  CONSTRAINT user_time_based_stats_pkey PRIMARY KEY (user_id, period_type, period_date),
  CONSTRAINT user_time_based_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.function_usage (
  function_name text NOT NULL,
  last_called_at timestamp with time zone,
  CONSTRAINT function_usage_pkey PRIMARY KEY (function_name)
);
CREATE TABLE public.processed_test_sessions (
  test_session_id bigint NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  process_type text,
  CONSTRAINT processed_test_sessions_pkey PRIMARY KEY (test_session_id)
);
CREATE TABLE public.outcome_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  outcome_id bigint NOT NULL,
  start_week integer NOT NULL CHECK (start_week >= 1),
  end_week integer NOT NULL CHECK (end_week >= 1),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT outcome_weeks_pkey PRIMARY KEY (id),
  CONSTRAINT outcome_weeks_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.outcomes(id)
);
CREATE TABLE public.topic_content_outcomes (
  topic_content_id bigint NOT NULL,
  outcome_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT topic_content_outcomes_pkey PRIMARY KEY (topic_content_id, outcome_id),
  CONSTRAINT topic_content_outcomes_topic_content_id_fkey FOREIGN KEY (topic_content_id) REFERENCES public.topic_contents(id),
  CONSTRAINT topic_content_outcomes_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.outcomes(id)
);
CREATE TABLE public.special_week_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  grade_id bigint,
  lesson_id bigint,
  curriculum_week integer CHECK (curriculum_week >= 1 AND curriculum_week <= 52),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['special_content'::text, 'break'::text, 'social_activity'::text])),
  title text NOT NULL,
  subtitle text,
  content_html text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  start_date date,
  end_date date,
  grade_ids ARRAY,
  CONSTRAINT special_week_events_pkey PRIMARY KEY (id),
  CONSTRAINT special_week_events_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT special_week_events_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT special_week_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_outcomes (
  question_id bigint NOT NULL,
  outcome_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT question_outcomes_pkey PRIMARY KEY (question_id, outcome_id),
  CONSTRAINT question_outcomes_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.outcomes(id),
  CONSTRAINT question_outcomes_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.topic_content_highlights (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_content_id bigint NOT NULL,
  icon text,
  title text NOT NULL,
  description text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  CONSTRAINT topic_content_highlights_pkey PRIMARY KEY (id),
  CONSTRAINT topic_content_highlights_topic_content_id_fkey FOREIGN KEY (topic_content_id) REFERENCES public.topic_contents(id)
);
CREATE TABLE public.topic_content_tips (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_content_id bigint NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Biliyor musun?'::text,
  content text NOT NULL,
  CONSTRAINT topic_content_tips_pkey PRIMARY KEY (id),
  CONSTRAINT topic_content_tips_topic_content_id_fkey FOREIGN KEY (topic_content_id) REFERENCES public.topic_contents(id)
);
CREATE TABLE public.user_topic_content_progress (
  user_id uuid NOT NULL,
  topic_id bigint NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  last_viewed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_topic_content_progress_pkey PRIMARY KEY (user_id, topic_id),
  CONSTRAINT user_topic_content_progress_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id),
  CONSTRAINT fk_utcp_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.topic_content_sections (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_content_id bigint NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  heading text NOT NULL,
  body_markdown text,
  image_url text,
  image_prompt text,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'content_ready'::text, 'image_ready'::text, 'published'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  image_alt text,
  diagram_svg text,
  source text NOT NULL DEFAULT 'manual'::text CHECK (source = ANY (ARRAY['manual'::text, 'ai_generated'::text])),
  ai_model text,
  CONSTRAINT topic_content_sections_pkey PRIMARY KEY (id),
  CONSTRAINT topic_content_sections_topic_content_id_fkey FOREIGN KEY (topic_content_id) REFERENCES public.topic_contents(id)
);
CREATE TABLE public.topic_content_section_outcomes (
  section_id bigint NOT NULL,
  outcome_id bigint NOT NULL,
  CONSTRAINT topic_content_section_outcomes_pkey PRIMARY KEY (section_id, outcome_id),
  CONSTRAINT topic_content_section_outcomes_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.topic_content_sections(id),
  CONSTRAINT topic_content_section_outcomes_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.outcomes(id)
);
CREATE TABLE public.schools (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  meb_kurum_kodu text UNIQUE,
  name text NOT NULL,
  school_type text NOT NULL CHECK (school_type = ANY (ARRAY['anaokulu'::text, 'ilkokul'::text, 'ortaokul'::text, 'lise'::text])),
  city_id integer NOT NULL,
  district_id bigint,
  host text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT schools_pkey PRIMARY KEY (id),
  CONSTRAINT fk_schools_city FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT fk_schools_district FOREIGN KEY (district_id) REFERENCES public.districts(id)
);
CREATE TABLE public.curriculum_calendar_settings (
  id bigint NOT NULL DEFAULT 1 CHECK (id = 1),
  term_start_date date NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  term_end_date date,
  CONSTRAINT curriculum_calendar_settings_pkey PRIMARY KEY (id),
  CONSTRAINT curriculum_calendar_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.rag_documents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text NOT NULL,
  file_path text,
  page_count integer,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'::text CHECK (status = ANY (ARRAY['processing'::text, 'ready'::text, 'failed'::text])),
  error_message text,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  grade_id bigint NOT NULL,
  lesson_id bigint NOT NULL,
  source text NOT NULL DEFAULT 'pdf_upload'::text CHECK (source = ANY (ARRAY['pdf_upload'::text, 'notebooklm_text'::text])),
  unit_id bigint,
  CONSTRAINT rag_documents_pkey PRIMARY KEY (id),
  CONSTRAINT rag_documents_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT rag_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id),
  CONSTRAINT rag_documents_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT rag_documents_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.rag_document_chunks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  document_id bigint NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer NOT NULL,
  embedding USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  grade_id bigint NOT NULL,
  lesson_id bigint NOT NULL,
  CONSTRAINT rag_document_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT rag_document_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.rag_documents(id),
  CONSTRAINT rag_document_chunks_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT rag_document_chunks_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.rag_answers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  student_id uuid,
  question text NOT NULL,
  answer text NOT NULL,
  matched_chunk_ids ARRAY NOT NULL DEFAULT '{}'::bigint[],
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text, 'deleted'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  grade_id bigint NOT NULL,
  lesson_id bigint NOT NULL,
  question_context text,
  unit_id bigint,
  quiz_question_id bigint,
  parent_comment_id bigint,
  parent_rag_answer_id bigint,
  CONSTRAINT rag_answers_pkey PRIMARY KEY (id),
  CONSTRAINT rag_answers_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT rag_answers_quiz_question_id_fkey FOREIGN KEY (quiz_question_id) REFERENCES public.questions(id),
  CONSTRAINT rag_answers_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.question_comments(id),
  CONSTRAINT rag_answers_parent_rag_answer_id_fkey FOREIGN KEY (parent_rag_answer_id) REFERENCES public.rag_answers(id),
  CONSTRAINT rag_answers_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT rag_answers_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id),
  CONSTRAINT rag_answers_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT rag_answers_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.rag_answer_reports (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  rag_answer_id bigint NOT NULL,
  student_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamp with time zone,
  CONSTRAINT rag_answer_reports_pkey PRIMARY KEY (id),
  CONSTRAINT rag_answer_reports_rag_answer_id_fkey FOREIGN KEY (rag_answer_id) REFERENCES public.rag_answers(id),
  CONSTRAINT rag_answer_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT rag_answer_reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.question_comments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint,
  parent_comment_id bigint,
  student_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'published'::text, 'rejected'::text, 'deleted'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  unit_id bigint,
  parent_ai_answer_id bigint,
  CONSTRAINT question_comments_pkey PRIMARY KEY (id),
  CONSTRAINT question_comments_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT question_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES public.question_comments(id),
  CONSTRAINT question_comments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT question_comments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id),
  CONSTRAINT question_comments_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT question_comments_parent_ai_answer_id_fkey FOREIGN KEY (parent_ai_answer_id) REFERENCES public.rag_answers(id)
);