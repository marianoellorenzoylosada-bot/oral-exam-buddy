import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target, Award, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { format } from "date-fns";

/* ── fetch all exams ── */
function useExams() {
  return useQuery({
    queryKey: ["exams-progress"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ── colour palette ── */
const COLORS = [
  "hsl(199, 89%, 48%)",  // accent
  "hsl(160, 84%, 39%)",  // success
  "hsl(38, 92%, 50%)",   // warning
  "hsl(222, 47%, 20%)",  // primary
  "hsl(0, 72%, 51%)",    // destructive
  "hsl(270, 60%, 55%)",
];

export default function ProgressPage() {
  const { data: exams = [], isLoading } = useExams();

  /* ── derived stats ── */
  const stats = useMemo(() => {
    if (!exams.length) return null;

    const scores = exams.map((e) => Number(e.overall_score));
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = Math.max(...scores);

    // Criteria averages for radar
    const criteriaMap: Record<string, { total: number; count: number }> = {};
    exams.forEach((e) => {
      const crit = e.criteria as any[];
      crit?.forEach((c: any) => {
        if (!criteriaMap[c.name]) criteriaMap[c.name] = { total: 0, count: 0 };
        criteriaMap[c.name].total += Number(c.score);
        criteriaMap[c.name].count += 1;
      });
    });
    const radarData = Object.entries(criteriaMap).map(([name, v]) => ({
      criterion: name,
      average: +(v.total / v.count).toFixed(2),
      fullMark: 5,
    }));

    // Score trend (chronological)
    const trendData = exams.map((e) => ({
      date: format(new Date(e.created_at), "dd MMM"),
      score: Number(e.overall_score),
      label: e.title,
    }));

    // Level distribution
    const levelCounts: Record<string, number> = {};
    exams.forEach((e) => {
      levelCounts[e.level_code] = (levelCounts[e.level_code] || 0) + 1;
    });
    const levelData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

    // Language distribution
    const langCounts: Record<string, number> = {};
    exams.forEach((e) => {
      langCounts[e.language] = (langCounts[e.language] || 0) + 1;
    });
    const langData = Object.entries(langCounts).map(([name, value]) => ({ name, value }));

    return { avg, best, total: exams.length, radarData, trendData, levelData, langData };
  }, [exams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Progress</h1>
          <p className="mt-1 text-muted-foreground">Track student performance over time.</p>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-display mt-4">No Exams Yet</CardTitle>
            <CardDescription>Complete your first exam to start seeing analytics here.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Progress</h1>
        <p className="mt-1 text-muted-foreground">
          Longitudinal analytics across {stats.total} exam{stats.total !== 1 ? "s" : ""}.
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.avg.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.best.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></p>
          </CardContent>
        </Card>
      </div>

      {/* ── Score trend ── */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Score Trend</CardTitle>
          <CardDescription>Overall score progression over time.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 5]} className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line type="monotone" dataKey="score" stroke="hsl(199, 89%, 48%)" strokeWidth={2} dot={{ fill: "hsl(199, 89%, 48%)", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Radar + distributions ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Radar */}
        {stats.radarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Criteria Averages</CardTitle>
              <CardDescription>Mean score per CEFR assessment criterion.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={stats.radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis dataKey="criterion" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar dataKey="average" stroke="hsl(199, 89%, 48%)" fill="hsl(199, 89%, 48%)" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Level distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Exams by Level</CardTitle>
            <CardDescription>CEFR level distribution.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.levelData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stats.levelData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Language pie */}
      {stats.langData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Language Distribution</CardTitle>
            <CardDescription>Exams broken down by assessed language.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.langData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" label>
                  {stats.langData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
