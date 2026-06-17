import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Target, Trophy, Flame, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [{ title: "Dashboard — TCS NQT Practice" }],
  }),
  component: Dashboard,
});

type Session = {
  id: string;
  topic: string;
  difficulty: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
};

function Dashboard() {
  const { user, role } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("quiz_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .then(({ data }) => {
        setSessions((data ?? []) as Session[]);
        setLoading(false);
      });
  }, [user]);

  if (role === "admin") {
    return (
      <div className="p-8 max-w-6xl">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-8">
          Full admin panel (user management, platform analytics) is coming in the next iteration.
        </p>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You're signed in as an admin. The user-facing quiz experience is available for users
            you create.
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = sessions.length;
  const avgPct =
    total === 0
      ? 0
      : Math.round(
          (sessions.reduce((s, x) => s + x.score / x.total_questions, 0) / total) * 100,
        );

  const topicStats = sessions.reduce<Record<string, { sum: number; n: number }>>((acc, s) => {
    const k = s.topic;
    acc[k] = acc[k] || { sum: 0, n: 0 };
    acc[k].sum += s.score / s.total_questions;
    acc[k].n += 1;
    return acc;
  }, {});
  const topicEntries = Object.entries(topicStats).map(([t, v]) => ({
    topic: t,
    avg: Math.round((v.sum / v.n) * 100),
  }));
  const best = topicEntries.sort((a, b) => b.avg - a.avg)[0];
  const weakest = topicEntries.sort((a, b) => a.avg - b.avg)[0];

  // Streak: consecutive days
  const dates = new Set(sessions.map((s) => s.completed_at.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const chartData = sessions
    .slice(0, 10)
    .reverse()
    .map((s, i) => ({
      name: `#${i + 1}`,
      score: Math.round((s.score / s.total_questions) * 100),
    }));

  const cards = [
    { label: "Total Quizzes", value: total, icon: BookOpen },
    { label: "Average Score", value: `${avgPct}%`, icon: Target },
    { label: "Best Topic", value: best?.topic ?? "—", icon: Trophy },
    { label: "Current Streak", value: `${streak} day${streak === 1 ? "" : "s"}`, icon: Flame },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your aptitude practice progress</p>
        </div>
        <Link to="/practice">
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <BookOpen className="w-4 h-4 mr-2" /> Start Practicing
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{c.label}</div>
                  <div className="text-2xl font-bold mt-1">{c.value}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <c.icon className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" /> Score over time (last 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.01 250)" />
                    <XAxis dataKey="name" stroke="oklch(0.5 0.02 250)" fontSize={12} />
                    <YAxis stroke="oklch(0.5 0.02 250)" fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="oklch(0.62 0.13 162)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weakest Topic</CardTitle>
          </CardHeader>
          <CardContent>
            {weakest ? (
              <>
                <div className="text-2xl font-bold">{weakest.topic}</div>
                <div className="text-sm text-muted-foreground mt-1">{weakest.avg}% average</div>
                <p className="text-sm text-muted-foreground mt-4">
                  Practice this topic to boost your overall score.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Take some quizzes to see insights.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sessions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y">
              {sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{s.topic}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {s.difficulty} • {new Date(s.completed_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {s.score}/{s.total_questions}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.floor(s.time_taken_seconds / 60)}m {s.time_taken_seconds % 60}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      No quizzes yet.{" "}
      <Link to="/practice" className="text-accent underline">
        Take your first one
      </Link>
      .
    </div>
  );
}
