import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3, Target, Award, Activity, Download, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { generateProgressPdf } from "@/lib/generateProgressPdf";
import { ProgressSkeleton } from "@/components/PageSkeleton";

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

/* ── colour palette using semantic tokens ── */
const COLORS = [
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(270, 60%, 55%)",
];

function computeStats(exams: any[]) {
  if (!exams.length) return null;

  const scores = exams.map((e) => Number(e.overall_score));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const best = Math.max(...scores);

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

  const trendData = exams.map((e) => ({
    date: format(new Date(e.created_at), "dd MMM"),
    score: Number(e.overall_score),
    label: e.title,
  }));

  const levelCounts: Record<string, number> = {};
  exams.forEach((e) => { levelCounts[e.level_code] = (levelCounts[e.level_code] || 0) + 1; });
  const levelData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

  const langCounts: Record<string, number> = {};
  exams.forEach((e) => { langCounts[e.language] = (langCounts[e.language] || 0) + 1; });
  const langData = Object.entries(langCounts).map(([name, value]) => ({ name, value }));

  const criteriaNames = Object.keys(criteriaMap);
  const criteriaTrendData = exams.map((e) => {
    const row: Record<string, any> = { date: format(new Date(e.created_at), "dd MMM"), label: e.title };
    const crit = e.criteria as any[];
    crit?.forEach((c: any) => { row[c.name] = Number(c.score); });
    return row;
  });

  // Per-student breakdown (used in group view + PDF)
  const studentMap: Record<string, { total: number; count: number }> = {};
  exams.forEach((e) => {
    const name = (e.candidate_name || "").trim();
    if (!name) return;
    if (!studentMap[name]) studentMap[name] = { total: 0, count: 0 };
    studentMap[name].total += Number(e.overall_score);
    studentMap[name].count += 1;
  });
  const studentBreakdown = Object.entries(studentMap)
    .map(([name, v]) => ({ name, avg: +(v.total / v.count).toFixed(2), exams: v.count }))
    .sort((a, b) => b.avg - a.avg);

  return { avg, best, total: exams.length, radarData, trendData, levelData, langData, criteriaTrendData, criteriaNames, studentBreakdown };
}

export default function ProgressPage() {
  const { data: allExams = [], isLoading } = useExams();
  const [selectedCandidate, setSelectedCandidate] = useState<string>("__all__");
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");

  const candidateNames = useMemo(() => {
    const names = new Set<string>();
    allExams.forEach((e) => { if (e.candidate_name) names.add(e.candidate_name); });
    return Array.from(names).sort();
  }, [allExams]);

  const groupNames = useMemo(() => {
    const names = new Set<string>();
    allExams.forEach((e) => { if (e.group) names.add(e.group); });
    return Array.from(names).sort();
  }, [allExams]);

  const exams = useMemo(() => {
    return allExams.filter((e) => {
      if (selectedGroup !== "__all__" && e.group !== selectedGroup) return false;
      if (selectedCandidate !== "__all__" && e.candidate_name !== selectedCandidate) return false;
      return true;
    });
  }, [allExams, selectedCandidate, selectedGroup]);

  const stats = useMemo(() => computeStats(exams), [exams]);
  const isGroupView = selectedGroup !== "__all__" && selectedCandidate === "__all__";

  const handleExport = () => {
    if (!stats) return;
    const criteriaAverages = stats.radarData.map((r) => ({ name: r.criterion, average: r.average }));
    generateProgressPdf({
      candidateName: selectedCandidate === "__all__" ? null : selectedCandidate,
      groupName: isGroupView ? selectedGroup : null,
      totalExams: stats.total,
      avgScore: stats.avg,
      bestScore: stats.best,
      exams: exams.map((e) => ({
        title: e.title,
        date: format(new Date(e.created_at), "dd/MM/yyyy"),
        level: e.level_code,
        language: e.language,
        score: Number(e.overall_score),
        band: e.overall_band,
      })),
      criteriaAverages,
      studentBreakdown: isGroupView ? stats.studentBreakdown : undefined,
    });
  };

  if (isLoading) return <ProgressSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header with filter + export */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats
              ? `Longitudinal analytics across ${stats.total} exam${stats.total !== 1 ? "s" : ""}.`
              : "Track student performance over time."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {candidateNames.length > 0 && (
            <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
              <SelectTrigger className="w-[200px]">
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All Candidates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Candidates</SelectItem>
                {candidateNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {stats && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!stats && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-display mt-4">No Exams Yet</CardTitle>
            <CardDescription>
              {selectedCandidate !== "__all__"
                ? `No exams found for ${selectedCandidate}.`
                : "Complete your first exam to start seeing analytics here."}
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      )}

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{stats.avg.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></p>
              </CardContent>
            </Card>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-display">{stats.best.toFixed(1)}<span className="text-lg text-muted-foreground">/5</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Score trend */}
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
                    contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: "hsl(var(--accent))", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Per-criterion trend lines */}
          {stats.criteriaTrendData.length > 1 && stats.criteriaNames.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Criteria Trends</CardTitle>
                <CardDescription>Individual criterion scores tracked over time.</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.criteriaTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 5]} className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend />
                    {stats.criteriaNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Radar + distributions */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
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
                      <Radar dataKey="average" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

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
                      contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
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
                      contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
