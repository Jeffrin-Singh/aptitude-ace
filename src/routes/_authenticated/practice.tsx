import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TOPICS } from "@/lib/topics";
import * as Icons from "lucide-react";

export const Route = createFileRoute("/_authenticated/practice")({
  head: () => ({ meta: [{ title: "Practice — TCS NQT" }] }),
  component: PracticePage,
});

function PracticePage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<
    Record<string, { best: number; attempts: number }>
  >({});

  useEffect(() => {
    if (!user) return;
    supabase
      .from("quiz_sessions")
      .select("topic, score, total_questions")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const acc: Record<string, { best: number; attempts: number }> = {};
        (data ?? []).forEach((s: any) => {
          const pct = Math.round((s.score / s.total_questions) * 100);
          acc[s.topic] = acc[s.topic] || { best: 0, attempts: 0 };
          acc[s.topic].attempts += 1;
          if (pct > acc[s.topic].best) acc[s.topic].best = pct;
        });
        setStats(acc);
      });
  }, [user]);

  if (role === "admin") {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Admins cannot take quizzes.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-2">Practice</h1>
      <p className="text-muted-foreground mb-8">
        Pick a topic, then choose a difficulty level to start.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOPICS.map((t) => {
          const Icon = (Icons as any)[t.icon] ?? Icons.BookOpen;
          const s = stats[t.name];
          return (
            <Card key={t.slug} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  {s && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Best</div>
                      <div className="font-bold text-accent">{s.best}%</div>
                    </div>
                  )}
                </div>
                <CardTitle className="mt-3 text-lg">{t.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-3">
                  {s?.attempts ?? 0} attempt{s?.attempts === 1 ? "" : "s"}
                </div>
                <div className="flex gap-2 mb-2">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant="outline"
                      className="flex-1 capitalize"
                      onClick={() =>
                        navigate({
                          to: "/quiz/$topic/$difficulty",
                          params: { topic: t.slug, difficulty: d },
                        })
                      }
                    >
                      {d}
                    </Button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() =>
                    navigate({
                      to: "/quiz/$topic/$difficulty",
                      params: { topic: t.slug, difficulty: "exam" },
                    })
                  }
                >
                  <Icons.GraduationCap className="w-4 h-4 mr-2" /> Take Full Exam
                </Button>
              </CardContent>

            </Card>
          );
        })}
      </div>
    </div>
  );
}
