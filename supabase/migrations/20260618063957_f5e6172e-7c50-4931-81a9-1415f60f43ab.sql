
DROP VIEW IF EXISTS public.questions_public;

CREATE OR REPLACE FUNCTION public.get_questions(p_topic text, p_difficulty public.difficulty_level)
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
  WHERE q.topic = p_topic AND q.difficulty = p_difficulty;
$$;

REVOKE ALL ON FUNCTION public.get_questions(text, public.difficulty_level) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_questions(text, public.difficulty_level) TO authenticated;
