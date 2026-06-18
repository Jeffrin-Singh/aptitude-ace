import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen, Target, Clock, Award } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/users/$userId")({
  head: () => ({ meta: [{ title: "User performance — Admin" }] }),
  component: UserDetail,
});

type Session = {
  id: string;
  topic: string;
  difficulty: string;
  session_type: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number;
  completed_at: string;
};

type Profile = { id: string; email: string; full_name: string };

function UserDetail() {
  const { userId } = Route.useParams();
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin") {
      navigate({ to: "/" });
      return;
    }
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name").eq("id", userId).maybeSingle(),
        supabase
          .from("quiz_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("completed_at", { ascending: false }),
      ]);
      setProfile(p as Profile | null);
      setSessions((s ?? []) as Session[]);
      setLoading(false);
    })();
  }, [userId, role, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
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
  const examCount = sessions.filter((s) => s.session_type === "exam").length;
  const totalTimeMin = Math.round(
    sessions.reduce((s, x) => s + x.time_taken_seconds, 0) / 60,
  );

  const lineData = sessions
    .slice()
    .reverse()
    .map((s, i) => ({
      name: `#${i + 1}`,
      score: Math.round((s.score / s.total_questions) * 100),
      type: s.session_type,
    }));

  const topicStats = sessions.reduce<Record<string, { sum: number; n: number }>>(
    (acc, s) => {
      const pct = (s.score / s.total_questions) * 100;
      acc[s.topic] = acc[s.topic] || { sum: 0, n: 0 };
      acc[s.topic].sum += pct;
      acc[s.topic].n += 1;
      return acc;
    },
    {},
  );
  const barData = Object.entries(topicStats).map(([topic, v]) => ({
    topic,
    avg: Math.round(v.sum / v.n),
  }));

  const cards = [
    { label: "Total Quizzes", value: total, icon: BookOpen },
    { label: "Average Score", value: `${avgPct}%`, icon: Target },
    { label: "Exam Attempts", value: examCount, icon: Award },
    { label: "Time Practiced", value: `${totalTimeMin}m`, icon: Clock },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <Link
        to="/users"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All users
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{profile?.full_name || "User"}</h1>
        <p className="text-muted-foreground mt-1">{profile?.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score over time</CardTitle>
          </CardHeader>
          <CardContent>
            {lineData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No sessions yet.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="oklch(0.62 0.13 162)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Average per topic</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="topic" fontSize={10} angle={-15} textAnchor="end" height={60} />
                    <YAxis domain={[0, 100]} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="avg" fill="oklch(0.62 0.13 162)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session history</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Topic</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Score</th>
                    <th className="py-2 pr-4">%</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-4">
                        <Badge variant={s.session_type === "exam" ? "default" : "outline"} className="capitalize">
                          {s.session_type}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{s.topic}</td>
                      <td className="py-2.5 pr-4 capitalize">{s.difficulty}</td>
                      <td className="py-2.5 pr-4">
                        {s.score}/{s.total_questions}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-accent">
                        {Math.round((s.score / s.total_questions) * 100)}%
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {Math.floor(s.time_taken_seconds / 60)}m {s.time_taken_seconds % 60}s
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {new Date(s.completed_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
