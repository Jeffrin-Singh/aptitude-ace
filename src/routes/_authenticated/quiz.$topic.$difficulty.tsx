import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TOPIC_BY_SLUG, TIMER_MINUTES, type Difficulty } from "@/lib/topics";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quiz/$topic/$difficulty")({
  head: () => ({ meta: [{ title: "Quiz — TCS NQT" }] }),
  component: QuizPage,
});

type Question = {
  id: string;
  topic: string;
  difficulty: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type AnswerState = {
  selected: "a" | "b" | "c" | "d" | null;
  isCorrect: boolean;
  correctOption: "a" | "b" | "c" | "d";
  explanation: string;
  timeSpent: number;
};


function QuizPage() {
  const { topic: topicSlug, difficulty } = Route.useParams();
  const topic = TOPIC_BY_SLUG[topicSlug];
  const diff = difficulty as Difficulty;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [timeLeft, setTimeLeft] = useState(TIMER_MINUTES[diff] * 60);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const totalSeconds = TIMER_MINUTES[diff] * 60;

  // Load questions via safe RPC (no answers exposed)
  useEffect(() => {
    if (!topic) return;
    (supabase.rpc as any)("get_questions", { p_topic: topic, p_difficulty: diff }).then(
      ({ data, error }: { data: Question[] | null; error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5);
        setQuestions(shuffled as Question[]);
        setLoading(false);
      },
    );
  }, [topic, diff]);


  // Reset per-question timer
  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [current]);

  // Countdown
  useEffect(() => {
    if (submitted || loading) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, loading]);

  const q = questions[current];
  const answer = q ? answers[q.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(
    () => Object.values(answers).filter((a) => a.isCorrect).length,
    [answers],
  );

  const onAnswer = async (opt: "a" | "b" | "c" | "d") => {
    if (!q || answer) return;
    const timeSpent = Math.round((Date.now() - questionStartedAt.current) / 1000);
    const { data, error } = await (supabase.rpc as any)("grade_answer", {
      p_question_id: q.id,
      p_selected_option: opt,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      toast.error("Unable to grade answer");
      return;
    }
    const isCorrect = !!row.is_correct;
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        selected: opt,
        isCorrect,
        correctOption: row.correct_option as "a" | "b" | "c" | "d",
        explanation: row.explanation as string,
        timeSpent,
      },
    }));
    if (isCorrect) toast.success("Correct!");
    else toast.error("Incorrect");
  };


  const handleSubmit = async (auto = false) => {
    if (submitting || submitted) return;
    if (!user || questions.length === 0) return;
    setSubmitting(true);
    const timeTaken = Math.round((Date.now() - startedAt.current) / 1000);
    const score = Object.values(answers).filter((a) => a.isCorrect).length;

    const { data: sess, error: sErr } = await supabase
      .from("quiz_sessions")
      .insert({
        user_id: user.id,
        topic,
        difficulty: diff,
        score,
        total_questions: questions.length,
        time_taken_seconds: timeTaken,
      })
      .select()
      .single();

    if (sErr || !sess) {
      toast.error(sErr?.message ?? "Failed to save");
      setSubmitting(false);
      return;
    }

    const rows = questions
      .filter((qq) => answers[qq.id])
      .map((qq) => ({
        session_id: sess.id,
        user_id: user.id,
        question_id: qq.id,
        selected_option: answers[qq.id].selected,
        is_correct: answers[qq.id].isCorrect,
        time_spent_seconds: answers[qq.id].timeSpent,
      }));
    if (rows.length > 0) {
      await supabase.from("question_attempts").insert(rows);
    }

    setSubmitted(true);
    if (auto) toast.message("Time's up — quiz auto-submitted");
    navigate({ to: "/quiz/$topic/$difficulty/result/$sessionId", params: { topic: topicSlug, difficulty: diff, sessionId: sess.id } });
  };

  if (!topic) {
    return <div className="p-8">Unknown topic.</div>;
  }
  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="p-8 max-w-xl">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              No questions seeded yet for {topic} — {diff}.
            </p>
            <Link to="/practice">
              <Button variant="outline">Back to topics</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");
  const timePct = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-muted-foreground">{topic}</div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              Question {current + 1} / {questions.length}
            </h1>
            <Badge variant="outline" className="capitalize">
              {diff}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-accent font-semibold">{correctCount}</span>
            <span className="text-muted-foreground"> correct</span>
          </div>
          <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-accent" />
            <span className="font-mono font-bold tabular-nums">
              {mm}:{ss}
            </span>
          </div>
        </div>
      </div>

      <Progress value={timePct} className="mb-6 h-1.5" />

      {/* Question */}
      <Card className="mb-4">
        <CardContent className="p-6">
          <p className="text-base leading-relaxed mb-6 whitespace-pre-wrap">{q.question_text}</p>
          <div className="grid gap-3">
            {(["a", "b", "c", "d"] as const).map((opt) => {
              const text = q[`option_${opt}` as keyof Question] as string;
              const isSelected = answer?.selected === opt;
              const isCorrectOpt = answer?.correctOption === opt;
              const showResult = !!answer;
              return (
                <button
                  key={opt}
                  disabled={!!answer}
                  onClick={() => onAnswer(opt)}
                  className={cn(
                    "text-left px-4 py-3 rounded-lg border-2 transition-all flex items-start gap-3",
                    !showResult && "hover:border-accent hover:bg-accent/5 cursor-pointer",
                    showResult && isCorrectOpt && "border-success bg-success/10",
                    showResult && isSelected && !isCorrectOpt && "border-destructive bg-destructive/10",
                    showResult && !isSelected && !isCorrectOpt && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center font-semibold text-sm shrink-0 uppercase",
                      showResult && isCorrectOpt && "border-success text-success",
                      showResult && isSelected && !isCorrectOpt && "border-destructive text-destructive",
                    )}
                  >
                    {opt}
                  </div>
                  <span className="flex-1 pt-0.5">{text}</span>
                  {showResult && isCorrectOpt && <CheckCircle2 className="w-5 h-5 text-success shrink-0" />}
                  {showResult && isSelected && !isCorrectOpt && (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {answer && (
            <div className="mt-5 p-4 rounded-lg bg-muted border-l-4 border-accent">
              <div className="font-semibold text-sm mb-2">Explanation</div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {q.explanation}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation dots */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {questions.map((qq, i) => {
          const a = answers[qq.id];
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className={cn(
                "w-8 h-8 rounded text-xs font-medium border",
                i === current && "ring-2 ring-accent ring-offset-2",
                !a && "bg-muted",
                a?.isCorrect && "bg-success text-success-foreground border-success",
                a && !a.isCorrect && "bg-destructive text-destructive-foreground border-destructive",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          Previous
        </Button>
        <div className="text-sm text-muted-foreground">
          {answeredCount} / {questions.length} answered
        </div>
        {current < questions.length - 1 ? (
          <Button onClick={() => setCurrent((c) => c + 1)} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Next
          </Button>
        ) : (
          <Button
            onClick={() => handleSubmit(false)}
            disabled={submitting || answeredCount === 0}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Quiz"}
          </Button>
        )}
      </div>
    </div>
  );
}
