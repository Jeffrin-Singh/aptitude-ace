import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Target, CheckCircle2, XCircle } from "lucide-react";
import { TOPIC_BY_SLUG } from "@/lib/topics";

export const Route = createFileRoute("/_authenticated/quiz/$topic/$difficulty/result/$sessionId")({
  head: () => ({ meta: [{ title: "Result — TCS NQT" }] }),
  component: ResultPage,
});

type Session = {
  id: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  topic: string;
  difficulty: string;
};

function ResultPage() {
  const { sessionId, topic: topicSlug, difficulty } = Route.useParams();
  const topic = TOPIC_BY_SLUG[topicSlug];
  const [sess, setSess] = useState<Session | null>(null);

  useEffect(() => {
    supabase
      .from("quiz_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => setSess(data as Session | null));
  }, [sessionId]);

  if (!sess) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const pct = Math.round((sess.score / sess.total_questions) * 100);
  const wrong = sess.total_questions - sess.score;
  const mm = Math.floor(sess.time_taken_seconds / 60);
  const ss = sess.time_taken_seconds % 60;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-accent to-[oklch(0.5_0.13_162)] text-accent-foreground p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <div className="text-sm opacity-90 mb-1">{topic} • <span className="capitalize">{difficulty}</span></div>
          <div className="text-5xl font-bold mb-2">
            {sess.score} / {sess.total_questions}
          </div>
          <div className="text-2xl opacity-90">{pct}%</div>
        </div>

        <CardContent className="p-8">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat icon={CheckCircle2} label="Correct" value={sess.score} color="text-success" />
            <Stat icon={XCircle} label="Wrong" value={wrong} color="text-destructive" />
            <Stat icon={Clock} label="Time" value={`${mm}m ${ss}s`} color="text-accent" />
          </div>

          <div className="p-4 rounded-lg bg-muted text-sm mb-6">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" /> Insight
            </div>
            <p className="text-muted-foreground">
              {pct >= 80
                ? `Excellent work on ${topic}! You're well-prepared for this topic.`
                : pct >= 50
                  ? `Good attempt. Review the explanations and retry — aim for 80%+ to master ${topic}.`
                  : `${topic} needs more practice. Re-read the explanations and try again at the same difficulty.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/quiz/$topic/$difficulty" params={{ topic: topicSlug, difficulty }}>
              <Button variant="outline">Try Again</Button>
            </Link>
            <Link to="/practice">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                Try Another Topic
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="text-center p-4 rounded-lg border">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
