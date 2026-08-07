import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, TrendingUp, Info } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/**
 * Candidate profile: every confirmed evaluation linked to this roster student,
 * grouped by stable identity (candidate_id) instead of the typed name.
 */
export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: student } = useQuery({
    queryKey: ["student", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["candidate-exams", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("candidate_id", id!)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!exams.length) return null;
    const scores = exams.map((e: any) => Number(e.overall_score));
    const criteriaMap: Record<string, { total: number; count: number }> = {};
    exams.forEach((e: any) => {
      (e.criteria as any[])?.forEach((c: any) => {
        if (!criteriaMap[c.name]) criteriaMap[c.name] = { total: 0, count: 0 };
        criteriaMap[c.name].total += Number(c.score);
        criteriaMap[c.name].count += 1;
      });
    });
    return {
      avg: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
      best: Math.max(...scores),
      latest: exams[exams.length - 1],
      criteria: Object.entries(criteriaMap).map(([name, v]) => ({ name, average: +(v.total / v.count).toFixed(2) })),
      trend: exams.map((e: any) => ({
        date: format(new Date(e.created_at), "dd MMM"),
        score: Number(e.overall_score),
      })),
    };
  }, [exams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/roster"><ArrowLeft className="mr-2 h-4 w-4" /> Roster</Link>
        </Button>
      </div>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {student?.full_name ?? "Candidate"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Assessment history linked to this candidate's roster identity.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !exams.length ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <GraduationCap className="h-5 w-5" />
            No evaluations linked to this candidate yet. Pick them from the roster when recording a session.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardDescription>Evaluations</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{exams.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Average score</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{stats?.avg}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Latest band</CardDescription></CardHeader>
              <CardContent className="text-2xl font-semibold">{(stats?.latest as any)?.overall_band}</CardContent>
            </Card>
          </div>

          {exams.length < 2 ? (
            <Card>
              <CardContent className="flex items-start gap-3 py-6 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Progress needs at least two evaluations. Record another session to see the trend.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" /> Score evolution
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats?.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average by criterion</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {stats?.criteria.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-md border bg-card p-2.5 text-sm">
                  <span>{c.name}</span>
                  <Badge variant="outline">{c.average} / 5</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluations</CardTitle>
              <CardDescription>Most recent first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[...exams].reverse().map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd/MM/yyyy")} · {e.level_code}
                      {e.group ? ` · ${e.group}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{e.overall_band}</Badge>
                    <Badge>{Number(e.overall_score)} / 5</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
