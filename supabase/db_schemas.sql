-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cities (
  id integer NOT NULL,
  name text NOT NULL UNIQUE,
  CONSTRAINT cities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.curriculum_week_question_counts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  unit_id bigint NOT NULL,
  total_questions integer NOT NULL DEFAULT 0,
  curriculum_week integer,
  CONSTRAINT curriculum_week_question_counts_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_question_counts_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.districts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  city_id integer NOT NULL,
  CONSTRAINT districts_pkey PRIMARY KEY (id),
  CONSTRAINT fk_districts_city FOREIGN KEY (city_id) REFERENCES public.cities(id)
);
CREATE TABLE public.function_usage (
  function_name text NOT NULL,
  last_called_at timestamp with time zone,
  CONSTRAINT function_usage_pkey PRIMARY KEY (function_name)
);
CREATE TABLE public.grades (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  order_no integer NOT NULL DEFAULT 0 UNIQUE CHECK (order_no >= 0),
  is_active boolean NOT NULL DEFAULT true,
  question_count integer NOT NULL DEFAULT 0,
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lesson_grades (
  lesson_id bigint NOT NULL,
  grade_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  question_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT lesson_grades_pkey PRIMARY KEY (lesson_id, grade_id),
  CONSTRAINT fk_lg_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT fk_lg_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
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
CREATE TABLE public.outcome_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  outcome_id bigint NOT NULL,
  start_week integer NOT NULL CHECK (start_week >= 1),
  end_week integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT outcome_weeks_pkey PRIMARY KEY (id),
  CONSTRAINT outcome_weeks_outcome_id_fkey FOREIGN KEY (outcome_id) REFERENCES public.outcomes(id)
);
CREATE TABLE public.outcomes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_id bigint NOT NULL,
  description text NOT NULL,
  order_index integer CHECK (order_index >= 0),
  CONSTRAINT outcomes_pkey PRIMARY KEY (id),
  CONSTRAINT fk_outcomes_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id)
);
CREATE TABLE public.processed_test_sessions (
  test_session_id bigint NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  process_type text,
  CONSTRAINT processed_test_sessions_pkey PRIMARY KEY (test_session_id)
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
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT fk_profiles_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id),
  CONSTRAINT fk_profiles_city FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT fk_profiles_district FOREIGN KEY (district_id) REFERENCES public.districts(id)
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
  CONSTRAINT question_classical_pkey PRIMARY KEY (question_id),
  CONSTRAINT question_classical_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_matching_pairs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  left_text text NOT NULL,
  right_text text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  CONSTRAINT question_matching_pairs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_qmp_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.question_types (
  id smallint NOT NULL,
  code text NOT NULL UNIQUE,
  CONSTRAINT question_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.question_usages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_id bigint NOT NULL,
  topic_id bigint NOT NULL,
  usage_type text NOT NULL CHECK (usage_type = ANY (ARRAY['weekly'::text, 'topic_end'::text])),
  created_at timestamp with time zone DEFAULT now(),
  order_no smallint NOT NULL DEFAULT 0,
  curriculum_week integer,
  CONSTRAINT question_usages_pkey PRIMARY KEY (id),
  CONSTRAINT fk_qu_question FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT fk_qu_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id)
);
CREATE TABLE public.questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  question_type_id smallint NOT NULL,
  question_text text NOT NULL,
  difficulty smallint DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  score smallint DEFAULT 1 CHECK (score >= 1 AND score <= 10),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_question_type_id_fkey FOREIGN KEY (question_type_id) REFERENCES public.question_types(id)
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
  CONSTRAINT test_session_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT test_session_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT test_session_answers_test_session_id_fkey FOREIGN KEY (test_session_id) REFERENCES public.test_sessions(id)
);
CREATE TABLE public.test_session_questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  test_session_id bigint NOT NULL,
  question_id bigint NOT NULL,
  order_no integer NOT NULL CHECK (order_no >= 1 AND order_no <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT test_session_questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tsq_question FOREIGN KEY (question_id) REFERENCES public.questions(id),
  CONSTRAINT fk_tsq_test_session FOREIGN KEY (test_session_id) REFERENCES public.test_sessions(id)
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
  CONSTRAINT test_sessions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT fk_test_sessions_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT fk_test_sessions_grade FOREIGN KEY (grade_id) REFERENCES public.grades(id)
);
CREATE TABLE public.topic_content_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_content_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  curriculum_week integer,
  CONSTRAINT topic_content_weeks_pkey PRIMARY KEY (id),
  CONSTRAINT topic_content_weeks_topic_content_id_fkey FOREIGN KEY (topic_content_id) REFERENCES public.topic_contents(id)
);
CREATE TABLE public.topic_contents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  topic_id bigint NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  order_no integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT topic_contents_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tc_topic FOREIGN KEY (topic_id) REFERENCES public.topics(id)
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
  question_count integer NOT NULL DEFAULT 0,
  CONSTRAINT topics_pkey PRIMARY KEY (id),
  CONSTRAINT topics_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.unit_grades (
  unit_id bigint NOT NULL,
  grade_id bigint NOT NULL,
  end_week smallint,
  start_week integer,
  CONSTRAINT unit_grades_pkey PRIMARY KEY (unit_id, grade_id),
  CONSTRAINT unit_grades_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT unit_grades_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id)
);
CREATE TABLE public.unit_videos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text,
  video_url text NOT NULL,
  order_no integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  unit_id bigint NOT NULL,
  CONSTRAINT unit_videos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tv_unit FOREIGN KEY (unit_id) REFERENCES public.units(id)
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
  slug text UNIQUE,
  question_count integer NOT NULL DEFAULT 0,
  CONSTRAINT units_pkey PRIMARY KEY (id),
  CONSTRAINT fk_units_lesson FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.user_curriculum_week_run_summary (
  user_id uuid NOT NULL,
  unit_id bigint NOT NULL,
  curriculum_week integer NOT NULL,
  run_no integer NOT NULL DEFAULT 1,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_curriculum_week_run_summary_pkey PRIMARY KEY (user_id, unit_id, curriculum_week, run_no),
  CONSTRAINT user_curriculum_week_run_summary_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT user_curriculum_week_run_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_curriculum_week_seen_questions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  unit_id bigint NOT NULL,
  question_id bigint NOT NULL,
  is_correct boolean NOT NULL,
  answered_at timestamp with time zone NOT NULL DEFAULT now(),
  curriculum_week integer,
  test_session_id bigint NOT NULL,
  CONSTRAINT user_curriculum_week_seen_questions_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ucwsq_test_session FOREIGN KEY (test_session_id) REFERENCES public.test_sessions(id),
  CONSTRAINT user_weekly_question_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_weekly_question_progress_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT user_weekly_question_progress_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
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
  CONSTRAINT user_question_stats_pkey PRIMARY KEY (user_id, question_id),
  CONSTRAINT user_question_stats_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_question_stats_question_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id)
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
CREATE TABLE public.user_unit_seen_questions (
  user_id uuid NOT NULL,
  unit_id bigint NOT NULL,
  question_id bigint NOT NULL,
  last_result boolean NOT NULL,
  last_solved_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_unit_seen_questions_pkey PRIMARY KEY (user_id, unit_id, question_id),
  CONSTRAINT fk_uusq_user FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_uusq_unit FOREIGN KEY (unit_id) REFERENCES public.units(id),
  CONSTRAINT fk_uusq_question FOREIGN KEY (question_id) REFERENCES public.questions(id)
);
CREATE TABLE public.user_unit_summary (
  user_id uuid NOT NULL,
  unit_id bigint NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  solved_question_count integer NOT NULL DEFAULT 0,
  CONSTRAINT user_unit_summary_pkey PRIMARY KEY (user_id, unit_id),
  CONSTRAINT user_unit_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_unit_summary_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);
CREATE TABLE public.user_weekly_summary (
  user_id uuid NOT NULL,
  unit_id bigint NOT NULL,
  curriculum_week integer NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  last_updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_weekly_summary_pkey PRIMARY KEY (user_id, unit_id, curriculum_week),
  CONSTRAINT user_weekly_summary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_weekly_summary_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);