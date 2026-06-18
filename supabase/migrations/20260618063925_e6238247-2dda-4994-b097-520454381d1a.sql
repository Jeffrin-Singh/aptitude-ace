
-- 1. user_roles: admin-only INSERT/DELETE
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Restrict questions table SELECT to admins only
DROP POLICY IF EXISTS "Auth read questions" ON public.questions;

CREATE POLICY "Admins read questions" ON public.questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Safe view: question content without the answer
CREATE OR REPLACE VIEW public.questions_public
WITH (security_invoker = true) AS
SELECT id, topic, difficulty, question_text,
       option_a, option_b, option_c, option_d, created_at
FROM public.questions;

-- View needs underlying access; create a policy allowing authenticated to read
-- the safe columns via the view. security_invoker means the view uses the
-- caller's RLS, so add a permissive SELECT policy scoped to non-answer reads.
-- Simpler: make the view SECURITY DEFINER-style by switching to definer.
ALTER VIEW public.questions_public SET (security_invoker = false);

GRANT SELECT ON public.questions_public TO authenticated;

-- 4. Server-side grading RPC (one question at a time)
CREATE OR REPLACE FUNCTION public.grade_answer(
  p_question_id uuid,
  p_selected_option char
)
RETURNS TABLE (is_correct boolean, correct_option char, explanation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (q.correct_option = p_selected_option) AS is_correct,
         q.correct_option,
         q.explanation
  FROM public.questions q
  WHERE q.id = p_question_id;
$$;

REVOKE ALL ON FUNCTION public.grade_answer(uuid, char) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_answer(uuid, char) TO authenticated;
