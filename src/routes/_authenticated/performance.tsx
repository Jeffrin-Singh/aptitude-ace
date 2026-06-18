import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({ meta: [{ title: "My Performance — TCS NQT" }] }),
  component: PerformancePage,
});

function PerformancePage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("quiz_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .then(({ data }) => setSessions(data ?? []));
  }, [user]);

  const topicStats = sessions.reduce<Record<string, { sum: number; n: number; best: number }>>(
    (acc, s) => {
      const pct = (s.score / s.total_questions) * 100;
      acc[s.topic] = acc[s.topic] || { sum: 0, n: 0, best: 0 };
      acc[s.topic].sum += pct;
      acc[s.topic].n += 1;
      if (pct > acc[s.topic].best) acc[s.topic].best = pct;
      return acc;
    },
    {},
  );
  const barData = Object.entries(topicStats).map(([topic, v]) => ({
    topic,
    avg: Math.round(v.sum / v.n),
  }));

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-2">My Performance</h1>
      <p className="text-muted-foreground mb-8">A breakdown of your aptitude practice history.</p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Average score per topic</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data yet. Take a quiz to see your performance.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="topic" fontSize={11} angle={-15} textAnchor="end" height={70} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="oklch(0.62 0.13 162)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All sessions</CardTitle>
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
                        <span
                          className={
                            "inline-block px-2 py-0.5 rounded text-xs font-medium capitalize " +
                            (s.session_type === "exam"
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {s.session_type ?? "practice"}
                        </span>
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
