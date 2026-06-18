
-- 1. Add 'mixed' to difficulty_level enum
ALTER TYPE public.difficulty_level ADD VALUE IF NOT EXISTS 'mixed';

-- 2. Add question_type to questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'practice'
    CHECK (question_type IN ('practice', 'exam'));

CREATE INDEX IF NOT EXISTS questions_topic_type_diff_idx
  ON public.questions (topic, question_type, difficulty);

-- 3. Add session_type to quiz_sessions
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'practice'
    CHECK (session_type IN ('practice', 'exam'));

-- 4. Replace get_questions to accept question_type filter
DROP FUNCTION IF EXISTS public.get_questions(text, public.difficulty_level);

CREATE OR REPLACE FUNCTION public.get_questions(
  p_topic text,
  p_difficulty public.difficulty_level,
  p_question_type text DEFAULT 'practice'
)
RETURNS TABLE (
  id uuid,
  topic text,
  difficulty public.difficulty_level,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.topic, q.difficulty, q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d
  FROM public.questions q
  WHERE q.topic = p_topic
    AND q.difficulty = p_difficulty
    AND q.question_type = p_question_type;
$$;

REVOKE ALL ON FUNCTION public.get_questions(text, public.difficulty_level, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_questions(text, public.difficulty_level, text) TO authenticated;

-- 5. Admin: list all users with aggregate stats
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  total_quizzes bigint,
  avg_score_pct numeric,
  last_active timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.email,
    p.full_name,
    COALESCE(
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
      'user'::public.app_role
    ) AS role,
    COALESCE(s.total_quizzes, 0) AS total_quizzes,
    COALESCE(s.avg_score_pct, 0)::numeric AS avg_score_pct,
    s.last_active,
    p.created_at
  FROM public.profiles p
  LEFT JOIN (
    SELECT
      qs.user_id,
      COUNT(*)::bigint AS total_quizzes,
      ROUND(AVG((qs.score::numeric / NULLIF(qs.total_questions, 0)) * 100), 1) AS avg_score_pct,
      MAX(qs.completed_at) AS last_active
    FROM public.quiz_sessions qs
    GROUP BY qs.user_id
  ) s ON s.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
