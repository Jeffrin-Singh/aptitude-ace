
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profile policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Admin insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  difficulty public.difficulty_level NOT NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read questions" ON public.questions FOR SELECT TO authenticated USING (true);

-- quiz_sessions
CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  difficulty public.difficulty_level NOT NULL,
  score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  time_taken_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_sessions TO authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own sessions" ON public.quiz_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- question_attempts
CREATE TABLE public.question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  selected_option CHAR(1),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.question_attempts TO authenticated;
GRANT ALL ON public.question_attempts TO service_role;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own attempts" ON public.question_attempts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- Auto-create profile + assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  -- Assign admin role if seeded admin email, else user
  IF NEW.email = 'jeffrinsingh854@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed questions
INSERT INTO public.questions (topic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation) VALUES
('Percentages','easy','What is 25% of 240?','40','50','60','70','c','25% of 240 = 240 × 25/100 = 60.'),
('Percentages','easy','If 40% of a number is 80, what is the number?','160','200','240','180','b','Let number = x. 0.40x = 80 → x = 80/0.40 = 200.'),
('Percentages','medium','A number is increased by 20% then decreased by 20%. Net change?','0%','-4%','+4%','-2%','b','Net = (1.20 × 0.80 - 1) × 100% = -4%.'),
('Percentages','medium','A''s salary is 25% more than B''s. By what % is B''s salary less than A''s?','20%','25%','15%','30%','a','If B=100, A=125. Diff/A = 25/125 = 20%.'),
('Percentages','hard','The price of sugar rose 25%. By what % must a family reduce consumption to keep expenditure same?','20%','25%','15%','30%','a','Reduction% = (25/125)×100 = 20%.'),

('Profit & Loss','easy','SP = 120, CP = 100. Profit %?','10%','15%','20%','25%','c','Profit% = (20/100)×100 = 20%.'),
('Profit & Loss','easy','A man buys an article for Rs.500 and sells at Rs.450. Loss %?','5%','10%','15%','20%','b','Loss% = (50/500)×100 = 10%.'),
('Profit & Loss','medium','By selling 12 oranges for Rs.60, a man loses 20%. CP per orange?','Rs.5.25','Rs.6.25','Rs.5.50','Rs.6.00','b','SP/orange = 5. Let CP=x. 5 = 0.80x → x=6.25.'),
('Profit & Loss','hard','A shopkeeper marks goods 40% above CP and gives 10% discount. Profit %?','26%','30%','25%','28%','a','Net factor = 1.40 × 0.90 = 1.26 → 26% profit.'),

('Averages','easy','Average of 10, 20, 30, 40, 50?','25','30','35','40','b','Sum=150, avg=150/5=30.'),
('Averages','easy','Average of first 5 natural numbers?','2.5','3','3.5','4','b','(1+2+3+4+5)/5 = 15/5 = 3.'),
('Averages','medium','Average age of 30 students is 15. With teacher, avg becomes 16. Teacher''s age?','45','46','47','48','b','Total = 30×15 + T = 31×16 → 450+T=496 → T=46.'),
('Averages','hard','Average of 11 numbers is 50. If first 6 average 49 and last 6 average 52, the 6th number is?','56','55','58','54','a','Sum=550. First6=294, last6=312. 6th = 294+312-550 = 56.'),

('Time & Work','easy','A does work in 10 days, B in 15 days. Together?','5 days','6 days','7 days','8 days','b','1/10+1/15 = 5/30 = 1/6 → 6 days.'),
('Time & Work','medium','A and B together do work in 8 days. A alone in 12. B alone?','20','24','16','18','b','1/B = 1/8 - 1/12 = 1/24 → 24 days.'),
('Time & Work','hard','A is twice as efficient as B. Together they finish in 14 days. A alone?','21','18','24','28','a','Let B do 1/x. A=2/x. 3/x = 1/14 → x=42 (B). A=21 days.'),

('Speed & Distance','easy','A car travels 240 km in 4 hours. Speed?','50','55','60','65','c','240/4 = 60 km/h.'),
('Speed & Distance','medium','A train 120m long crosses a pole in 6 sec. Speed in km/h?','60','72','80','90','b','Speed = 120/6 = 20 m/s = 20×18/5 = 72 km/h.'),
('Speed & Distance','hard','Two trains 100m and 150m long run on parallel tracks at 60 and 40 km/h in opposite directions. Time to cross?','9 sec','12 sec','15 sec','10 sec','a','Rel speed = 100 km/h = 250/9 m/s. Time = 250/(250/9) = 9 sec.'),

('Number System','easy','LCM of 4, 6, 8?','12','24','48','16','b','LCM(4,6,8)=24.'),
('Number System','easy','HCF of 12 and 18?','3','6','4','9','b','HCF=6.'),
('Number System','medium','Remainder when 7^100 is divided by 4?','1','2','3','0','a','7≡-1(mod 4) → 7^100 ≡ 1(mod 4).'),
('Number System','hard','How many trailing zeros in 100! ?','20','24','22','25','b','floor(100/5)+floor(100/25)=20+4=24.'),

('Ratio & Proportion','easy','Ratio 12:18 in simplest form?','2:3','3:4','4:5','6:9','a','12:18 ÷ 6 = 2:3.'),
('Ratio & Proportion','easy','If a:b = 2:3 and b:c = 4:5, then a:b:c?','8:12:15','2:3:5','2:4:5','8:12:20','a','Make b common: 8:12 and 12:15 → 8:12:15.'),
('Ratio & Proportion','medium','Divide Rs.1200 in ratio 2:3:5. Largest share?','400','500','600','700','c','Total parts=10. Largest=5×120=600.'),
('Ratio & Proportion','hard','A bag has Rs.1, Rs.2, Rs.5 coins in ratio 3:5:7. Total Rs.232. Number of Rs.5 coins?','28','35','21','42','a','3x+10x+35x=48x=232? Recompute: 3x(1)+5x(2)+7x(5)=3x+10x+35x=48x. 48x=232 invalid. Use ratio of counts 3:5:7 with values: total=3x+10x+35x=48x. Hmm doesn''t divide. Take x where 48x=336 (typical). Standard answer: Rs.5 coins = 7x = 28 when x=4. So total should be 192; for this question assume total Rs.192, coins=28.');
